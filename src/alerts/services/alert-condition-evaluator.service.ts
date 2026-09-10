import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { ContractBidCalculatorService } from 'src/contracts/services/contract-bid-calculator.service';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Alert } from '../entities/alert.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME, ALERT_THRESHOLDS, AlertType } from '../constants';

const ESCROW_ABI = ['function depositsOf(address) view returns (uint256)'];

@Injectable()
export class AlertConditionEvaluatorService {
  private readonly logger = createModuleLogger(
    AlertConditionEvaluatorService,
    MODULE_NAME,
  );

  constructor(
    private providerManager: ProviderManager,
    private contractBidCalculatorService: ContractBidCalculatorService,
  ) {}

  /**
   * Evaluate bid safety condition for an alert
   * Returns true if alert should be triggered (effective bid below threshold)
   */
  async evaluateBidSafetyCondition(
    alert: Alert,
    blockchain: Blockchain,
  ): Promise<boolean> {
    try {
      const cacheManagerInstance = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER,
      );

      // getMinBid(address) returns 0 for already-cached programs, so instead
      // use getSmallestEntries(1) to fetch only the single lowest-bid entry.
      // This is O(n) on-chain but returns minimal data, unlike getEntries()
      // which can OOM on large caches.
      const smallest: Array<{ code: string; size: bigint; bid: bigint }> =
        await cacheManagerInstance.getSmallestEntries(1);

      const minBid = smallest.length > 0 ? BigInt(smallest[0].bid) : 0n;

      // Calculate current effective bid
      const effectiveBid = BigInt(
        await this.contractBidCalculatorService.calculateCurrentContractEffectiveBid(
          alert.userContract.contract,
        ),
      );

      // Calculate threshold based on alert value
      const alertValueBigInt = BigInt(Math.round(Number(alert.value) * 100));
      const basePercentage = BigInt(
        ALERT_THRESHOLDS.BID_SAFETY_BASE_PERCENTAGE,
      );
      const multiplier = basePercentage + alertValueBigInt;
      const threshold = (minBid * multiplier) / basePercentage;

      const shouldTrigger = effectiveBid < threshold;

      this.logger.debug(
        `Bid safety evaluation for alert ${alert.id}: minBid=${minBid}, effectiveBid=${effectiveBid}, threshold=${threshold}, shouldTrigger=${shouldTrigger}`,
      );

      return shouldTrigger;
    } catch (error) {
      this.logger.error(
        `Error evaluating bid safety condition for alert ${alert.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Evaluate gas condition for noGas / lowGas alerts.
   * Reads the user's CMA escrow balance via depositsOf(userAddress).
   * Returns true if the alert should be triggered.
   */
  async evaluateGasCondition(
    alert: Alert,
    blockchain: Blockchain,
  ): Promise<boolean> {
    // Alert.user is nullable; without it there is no escrow to read.
    if (!alert.user?.address) {
      this.logger.debug(`Alert ${alert.id} has no user, skipping gas check`);
      return false;
    }

    try {
      const cmaContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER_AUTOMATION,
      );

      const escrowAddress: string = await cmaContract.escrow();
      const provider = (cmaContract as unknown as ethers.BaseContract).runner;
      const escrowContract = new ethers.Contract(
        escrowAddress,
        ESCROW_ABI,
        provider,
      );

      const balance = BigInt(
        (await escrowContract.depositsOf(alert.user.address)) as string,
      );

      let shouldTrigger: boolean;

      if (alert.type === AlertType.NO_GAS) {
        shouldTrigger = balance === 0n;
        this.logger.debug(
          `noGas evaluation for alert ${alert.id}: balance=${balance}, shouldTrigger=${shouldTrigger}`,
        );
      } else {
        // lowGas: value is the threshold in ETH
        const threshold = ethers.parseEther(String(alert.value));
        shouldTrigger = balance < threshold;
        this.logger.debug(
          `lowGas evaluation for alert ${alert.id}: balance=${balance}, threshold=${threshold}, shouldTrigger=${shouldTrigger}`,
        );
      }

      return shouldTrigger;
    } catch (error) {
      this.logger.error(
        `Error evaluating gas condition for alert ${alert.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Evaluate expiration condition for approachingExpiration / expired alerts.
   * Reads programTimeLeft from ArbWasm precompile.
   * Returns true if the alert should be triggered.
   */
  async evaluateExpirationCondition(
    alert: Alert,
    blockchain: Blockchain,
  ): Promise<boolean> {
    try {
      const arbWasm = this.providerManager.getContract(
        blockchain,
        ContractType.ARB_WASM,
      );

      let timeLeft: bigint;
      try {
        timeLeft = await arbWasm.programTimeLeft(alert.userContract.address);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('ProgramExpired') || msg.includes('0xc9b12e52')) {
          timeLeft = 0n;
        } else if (msg.includes('ProgramNotActivated')) {
          this.logger.debug(
            `Program ${alert.userContract.address} not activated, skipping alert ${alert.id}`,
          );
          return false;
        } else {
          throw error;
        }
      }

      let shouldTrigger: boolean;

      if (alert.type === AlertType.APPROACHING_EXPIRATION) {
        // value is a number of days and may be fractional (the DTO only
        // requires it to be positive); BigInt('7.5') would throw.
        // Round to whole seconds first and require a safe integer: a huge
        // value such as 1e308 overflows to Infinity, which BigInt rejects.
        const roundedSeconds = Math.round(Number(alert.value) * 86400);
        if (!Number.isSafeInteger(roundedSeconds) || roundedSeconds <= 0) {
          this.logger.warn(
            `Alert ${alert.id} has an invalid approachingExpiration threshold: ${alert.value}`,
          );
          return false;
        }
        const thresholdSeconds = BigInt(roundedSeconds);
        shouldTrigger = timeLeft > 0n && timeLeft < thresholdSeconds;
        this.logger.debug(
          `approachingExpiration evaluation for alert ${alert.id}: timeLeft=${timeLeft}s, threshold=${thresholdSeconds}s, shouldTrigger=${shouldTrigger}`,
        );
      } else {
        // expired
        shouldTrigger = timeLeft <= 0n;
        this.logger.debug(
          `expired evaluation for alert ${alert.id}: timeLeft=${timeLeft}s, shouldTrigger=${shouldTrigger}`,
        );
      }

      return shouldTrigger;
    } catch (error) {
      this.logger.error(
        `Error evaluating expiration condition for alert ${alert.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
