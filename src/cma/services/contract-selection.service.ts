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

      // Fetch constants from smart contract
      const [cacheThreshold, horizonSeconds, bidIncrement] = await Promise.all([
        this.getCacheThreshold(cmaContract),
        this.getHorizonSeconds(cmaContract),
        this.getBidIncrement(cmaContract),
      ]);

      this.logger.log(`Smart contract constants - Cache threshold: ${cacheThreshold}, Horizon seconds: ${horizonSeconds}, Bid increment: ${bidIncrement}`);

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
            cacheThreshold,
            horizonSeconds,
            bidIncrement,
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
    cacheThreshold: number,
    horizonSeconds: number,
    bidIncrement: bigint,
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
        cacheThreshold,
        horizonSeconds,
        bidIncrement,
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
    cacheThreshold: number,
    horizonSeconds: number,
    bidIncrement: bigint,
  ): bigint {
    // CACHE NOT FULL CASE
    // If cache is not full, return minBid (likely 0 for utilization < threshold)
    if (cacheUtilization < cacheThreshold) {
      return BigInt(0);
    }

    // CACHE FULL CASE (>= threshold usage)
    // Calculate decay value: minBid + decayRate * horizonSeconds
    const decayValue = minBid + decayRate * BigInt(horizonSeconds);

    // Add bid increment for uniqueness
    const bidWithIncrement =
      decayValue + BigInt(bidIndex) * bidIncrement;

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
      this.logger.error(
        `Failed to get cache utilization: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Cannot retrieve cache utilization from contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get decay rate from cache manager
   */
  private async getDecayRate(cmContract: CacheManager): Promise<bigint> {
    try {
      return await cmContract.decay();
    } catch (error) {
      this.logger.error(
        `Failed to get decay rate: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Cannot retrieve decay rate from contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get cache threshold from CacheManagerAutomation contract
   */
  private async getCacheThreshold(cmaContract: CacheManagerAutomation): Promise<number> {
    try {
      // Using direct method call since TypeScript interface might be outdated
      const threshold = await (cmaContract as any).cacheThreshold();
      return Number(threshold);
    } catch (error) {
      this.logger.error(
        `Failed to get cache threshold from contract: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Cannot retrieve cache threshold from contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get horizon seconds from CacheManagerAutomation contract
   */
  private async getHorizonSeconds(cmaContract: CacheManagerAutomation): Promise<number> {
    try {
      // Using direct method call since TypeScript interface might be outdated
      const horizon = await (cmaContract as any).horizonSeconds();
      return Number(horizon);
    } catch (error) {
      this.logger.error(
        `Failed to get horizon seconds from contract: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Cannot retrieve horizon seconds from contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get bid increment from CacheManagerAutomation contract
   */
  private async getBidIncrement(cmaContract: CacheManagerAutomation): Promise<bigint> {
    try {
      // Using direct method call since TypeScript interface might be outdated
      const increment = await (cmaContract as any).bidIncrement();
      return BigInt(increment.toString());
    } catch (error) {
      this.logger.error(
        `Failed to get bid increment from contract: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Cannot retrieve bid increment from contract: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
