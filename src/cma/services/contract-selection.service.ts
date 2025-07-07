import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { CacheManagerAutomation } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { CacheManager } from 'src/common/types/contracts/CacheManager';
import { ArbWasmCache } from 'src/common/types/contracts/ArbWasmCache';
import { ICacheManagerAutomationV2 } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';

import { CmaConfig } from '../cma.config';
import { SelectedContract } from '../interfaces';
import { MODULE_NAME } from '../constants';

@Injectable()
export class ContractSelectionService {
  private readonly logger = createModuleLogger(
    ContractSelectionService,
    MODULE_NAME,
  );

  // Smart contract constants
  private readonly CACHE_THRESHOLD = 98; // Start bidding when 98% full
  private readonly HORIZON_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly BID_INCREMENT = 1; // Bid increment for uniqueness
  private readonly DEFAULT_DECAY_RATE = 11574; // Default: approximately 1 gwei per day (1e9 / 86400)

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {}

  async selectOptimalBids(blockchain: Blockchain): Promise<SelectedContract[]> {
    const config = this.configService.get<CmaConfig>('cma');

    try {
      const cmaContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER_AUTOMATION,
      ) as unknown as CacheManagerAutomation;

      const cmContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER,
      ) as unknown as CacheManager;

      const arbWasmCacheContract = this.providerManager.getContract(
        blockchain,
        ContractType.ARB_WASM_CACHE,
      ) as unknown as ArbWasmCache;

      const provider = this.providerManager.getProvider(blockchain);

      // Fetch all contracts in batches until hasMore is false
      let automatedUserConfigs: ICacheManagerAutomationV2.UserContractsDataStructOutput[] =
        [];
      let offset = 0n;
      const limit = BigInt(config?.paginationLimit || 30);
      let hasMore = true;

      this.logger.log(`Fetching automated contracts for ${blockchain.name}...`);

      while (hasMore) {
        const result = await cmaContract.getContractsPaginated(offset, limit);
        const batchContracts = result.userData;
        hasMore = result.hasMore;

        automatedUserConfigs = automatedUserConfigs.concat(batchContracts);

        if (!hasMore) {
          break;
        }

        offset += limit;
      }

      this.logger.log(
        `Found ${automatedUserConfigs.length} users with automated contracts`,
      );

      // Get cache utilization once for all contracts
      const cacheUtilization = await this.getCacheUtilization(cmContract);
      this.logger.log(`Cache utilization: ${cacheUtilization}%`);

      // Get decay rate once for all contracts
      const decayRate = await this.getDecayRate(cmContract);
      this.logger.log(`Decay rate: ${decayRate}`);

      const selectedContracts: SelectedContract[] = [];
      let bidIndex = 0;

      for (const auc of automatedUserConfigs) {
        for (const contract of auc.contracts) {
          // Apply the same logic as smart contract's _shouldBid function
          const shouldBid = await this.shouldBid(
            auc.user,
            contract.contractAddress,
            contract.enabled,
            contract.maxBid,
            bidIndex,
            cacheUtilization,
            decayRate,
            cmContract,
            arbWasmCacheContract,
            provider,
          );

          if (shouldBid) {
            selectedContracts.push({
              user: auc.user,
              address: contract.contractAddress,
            });
            bidIndex++;
          }
        }
      }

      this.logger.log(
        `Selected ${selectedContracts.length} contracts for automation on ${blockchain.name}`,
      );
      return selectedContracts;
    } catch (error) {
      this.logger.error(
        `Contract selection failed for ${blockchain.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Implements the smart contract's _shouldBid logic
   */
  private async shouldBid(
    user: string,
    contractAddress: string,
    enabled: boolean,
    maxBid: bigint,
    bidIndex: number,
    cacheUtilization: number,
    decayRate: bigint,
    cmContract: CacheManager,
    arbWasmCacheContract: ArbWasmCache,
    provider: ethers.Provider,
  ): Promise<boolean> {
    try {
      // 1. Are addresses valid?
      if (
        !user ||
        user === ethers.ZeroAddress ||
        !contractAddress ||
        contractAddress === ethers.ZeroAddress
      ) {
        return false;
      }

      // 2. Is contract already cached?
      const contractCode = await provider.getCode(contractAddress);
      const contractCodeHash = ethers.keccak256(contractCode);
      const isCached =
        await arbWasmCacheContract.codehashIsCached(contractCodeHash);

      if (isCached) {
        return false;
      }

      // 3. Is contract enabled?
      if (!enabled) {
        return false;
      }

      // 4. Calculate bid amount
      const minBid = await cmContract['getMinBid(address)'](contractAddress);
      const calculatedBid = this.calculateBidAmount(
        maxBid,
        bidIndex,
        minBid,
        cacheUtilization,
        decayRate,
      );

      // 5. Check if bid is valid
      if (calculatedBid < minBid) {
        return false;
      }

      // 6. Skip balance check as requested by user
      // The contract will handle insufficient balance failures

      return true;
    } catch (error) {
      this.logger.warn(
        `Error checking if should bid for contract ${contractAddress}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Implements the smart contract's _calculateBidAmount logic
   */
  private calculateBidAmount(
    userMaxBid: bigint,
    bidIndex: number,
    minBid: bigint,
    cacheUtilization: number,
    decayRate: bigint,
  ): bigint {
    // CACHE NOT FULL CASE
    // If cache is not full, return minBid (likely 0 for utilization < 98%)
    if (cacheUtilization < this.CACHE_THRESHOLD) {
      return minBid;
    }

    // CACHE FULL CASE (>= 98% usage)
    // Calculate decay value: minBid + decayRate * horizonSeconds
    const decayValue = minBid + decayRate * BigInt(this.HORIZON_SECONDS);

    // Add bid increment for uniqueness
    const bidWithIncrement =
      decayValue + BigInt(bidIndex) * BigInt(this.BID_INCREMENT);

    // Return minimum of calculated bid and user's max bid
    return bidWithIncrement < userMaxBid ? bidWithIncrement : userMaxBid;
  }

  /**
   * Get cache utilization percentage
   */
  private async getCacheUtilization(cmContract: CacheManager): Promise<number> {
    try {
      const cacheSize = await cmContract.cacheSize();
      const queueSize = await cmContract.queueSize();

      if (cacheSize === 0n) {
        return 0;
      }

      const utilization = (Number(queueSize) * 100) / Number(cacheSize);
      return Math.floor(utilization);
    } catch (error) {
      this.logger.warn(
        `Error getting cache utilization: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Get decay rate from cache manager
   */
  private async getDecayRate(cmContract: CacheManager): Promise<bigint> {
    try {
      return await cmContract.decay();
    } catch (error) {
      this.logger.warn(
        `Error getting decay rate: ${error instanceof Error ? error.message : String(error)}`,
      );
      return BigInt(this.DEFAULT_DECAY_RATE);
    }
  }
}
