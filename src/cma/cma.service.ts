import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';
import { EngineUtil } from 'src/cma/utils/engine.util';
import { Repository } from 'typeorm';
import { CacheManagerAutomation } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { CacheManager } from 'src/common/types/contracts/CacheManager';
import { ArbWasmCache } from 'src/common/types/contracts/ArbWasmCache';
import { ICacheManagerAutomationV2 } from 'src/common/types/contracts/cacheManagerAutomation/CacheManagerAutomation';
import { ethers } from 'ethers';

@Injectable()
export class CmaService implements OnModuleInit {
  private readonly logger = new Logger(CmaService.name);

  constructor(
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    private providerManager: ProviderManager,
    private engineUtil: EngineUtil,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Automation system initialized.');
    await Promise.resolve();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCmaAutomation() {
    this.logger.log('CMA automation started.');
    const blockchains = await this.blockchainRepository.find({});

    for (const blockchain of blockchains) {
      await this.processCmaAutomation(blockchain);
    }
  }

  private async processCmaAutomation(blockchain: Blockchain) {
    this.logger.log(`Processing CMA automation for ${blockchain.name}`);

    const selectedContracts = await this.selectOptimalBids(blockchain);

    this.logger.log(
      `Selected ${selectedContracts.length} contracts for automation`,
    );

    if (selectedContracts.length > 0) {
      // Process contracts in batches of 50
      const batchSize = 50;
      const batches: { user: string; address: string }[][] = [];

      for (let i = 0; i < selectedContracts.length; i += batchSize) {
        batches.push(selectedContracts.slice(i, i + batchSize));
      }

      this.logger.log(`Processing ${batches.length} batches of contracts`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        try {
          // Prepare arguments for placeBids function - array of [user, contractAddress] tuples
          const contractArgs = batch.map((contract) => [
            contract.user,
            contract.address,
          ]);

          this.logger.log(
            `Attempting to call placeBids for batch ${batchIndex + 1}/${batches.length} with ${contractArgs.length} contracts`,
          );

          const result = await this.engineUtil.writeContract(
            blockchain.chainId,
            blockchain.cacheManagerAutomationAddress,
            {
              functionName: 'function placeBids((address,address)[])',
              args: [contractArgs],
            },
          );

          this.logger.log(
            `Batch ${batchIndex + 1}/${batches.length} placeBids result: ${JSON.stringify(result)}`,
          );
        } catch (error) {
          this.logger.error(
            `Batch ${batchIndex + 1}/${batches.length} placeBids error:`,
            error,
          );
          // Continue with next batch even if current batch fails
        }
      }
    }

    // Log individual contracts for reference
    for (const contract of selectedContracts) {
      this.logger.log(
        `Processed contract ${contract.address} for user ${contract.user}`,
      );
    }
  }

  private async selectOptimalBids(blockchain: Blockchain) {
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

      // Fetch all contracts in batches of 50 until hasMore is false
      let automatedUserConfigs: ICacheManagerAutomationV2.UserContractsDataStructOutput[] =
        [];
      let offset = 0n;
      const limit = 30n;
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

      const selectedContracts: { user: string; address: string }[] = [];

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
            // TODO: enhance the selection logic for avoiding competition.
            // This change will impact on cma contract since now the bidding amount is
            // always minBid.
            user: auc.user,
            address: contract.contractAddress,
          });
        }
      }
      return selectedContracts;
    } catch (error) {
      this.logger.error(`Error selecting optimal bids: ${error}`);
      return [];
    }
  }
}
