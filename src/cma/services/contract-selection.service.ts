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
}
