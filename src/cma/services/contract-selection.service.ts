import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { CacheManagerAutomation } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { CacheManager } from 'src/common/types/contracts/CacheManager';
import { ArbWasmCache } from 'src/common/types/contracts/ArbWasmCache';
import { ICacheManagerAutomationV2 } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';

import { CmaConfig } from '../cma.config';
import { SelectedContract } from '../interfaces';

@Injectable()
export class ContractSelectionService {
  private readonly logger = new Logger(ContractSelectionService.name);

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

      const cmConctract = this.providerManager.getContract(
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

      while (hasMore) {
        this.logger.debug(
          `Fetching contracts batch: offset=${offset}, limit=${limit}`,
        );

        const result = await cmaContract.getContractsPaginated(offset, limit);
        const batchContracts = result.userData; // Access userData property
        hasMore = result.hasMore; // Access hasMore property

        automatedUserConfigs = automatedUserConfigs.concat(batchContracts);

        this.logger.debug(
          `Fetched ${batchContracts.length} users in this batch. Total: ${automatedUserConfigs.length}. HasMore: ${hasMore}`,
        );

        if (!hasMore) {
          break;
        }

        offset += limit;
      }

      this.logger.debug(
        `Found ${automatedUserConfigs.length} users with automated contracts (total across all batches)`,
      );

      const selectedContracts: SelectedContract[] = [];

      for (const auc of automatedUserConfigs) {
        for (const contract of auc.contracts) {
          if (!contract.enabled) {
            continue;
          }

          const minBid = await cmConctract['getMinBid(address)'](
            contract.contractAddress,
          );
          if (minBid > contract.maxBid) {
            continue;
          }

          const contractCode = await provider.getCode(contract.contractAddress);
          const contractCodeHash = ethers.keccak256(contractCode);

          const isCached =
            await arbWasmCacheContract.codehashIsCached(contractCodeHash);

          if (isCached) {
            continue;
          }

          selectedContracts.push({
            user: auc.user,
            address: contract.contractAddress,
          });
        }
      }

      this.logger.log(
        `Selected ${selectedContracts.length} contracts for automation`,
      );
      return selectedContracts;
    } catch (error) {
      this.logger.error(`Error selecting optimal bids: ${error}`);
      // Return empty array on error to maintain backward compatibility
      return [];
    }
  }
}
