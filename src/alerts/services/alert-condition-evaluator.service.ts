import { Injectable } from '@nestjs/common';
import { ContractBidCalculatorService } from 'src/contracts/services/contract-bid-calculator.service';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Alert } from '../entities/alert.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME, ALERT_THRESHOLDS } from '../constants';

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
      this.logger.debug(
        `Evaluating bid safety condition for alert ${alert.id}`,
      );

      const cacheManagerInstance = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER,
      );

      // Get minimum bid for the contract
      const minBid = (await cacheManagerInstance['getMinBid(address program)'](
        alert.userContract.address,
      )) as bigint;

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
        `Bid safety evaluation for alert ${alert.id}: ` +
          `minBid=${minBid}, effectiveBid=${effectiveBid}, threshold=${threshold}, shouldTrigger=${shouldTrigger}`,
      );

      return shouldTrigger;
    } catch (error) {
      this.logger.error(
        `Error evaluating bid safety condition for alert ${alert.id}`,
        error,
      );
      throw error;
    }
  }
}
