import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { StateFetcherConfig } from './state-fetcher.config';
import { StateFetcherErrorHelpers } from './state-fetcher.errors';
import { ContractInteractionService, StateStorageService } from './services';
import { createModuleLogger } from '../common/utils/logger.util';
import { MODULE_NAME } from './constants';

@Injectable()
export class StateFetcherService implements OnModuleInit {
  private readonly logger = createModuleLogger(
    StateFetcherService,
    MODULE_NAME,
  );
  private readonly config: StateFetcherConfig;

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
    private readonly contractInteractionService: ContractInteractionService,
    private readonly stateStorageService: StateStorageService,
  ) {
    this.config = this.configService.get<StateFetcherConfig>('state-fetcher')!;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('Starting scheduled blockchain state polling...');

    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

    if (blockchains.length === 0) {
      this.logger.warn('No enabled blockchains found for scheduled polling');
      return;
    }

    this.logger.log(
      `Found ${blockchains.length} enabled blockchain(s) for polling`,
    );

    const pollingPromises = blockchains.map((blockchain) =>
      this.pollBlockchainSafely(blockchain, 'scheduled'),
    );

    const results = await Promise.allSettled(pollingPromises);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Scheduled polling completed: ${successful} successful, ${failed} failed`,
    );
  }

  async onModuleInit() {
    this.logger.log('Initializing StateFetcherService...');

    if (!this.config.enableInitialPolling) {
      this.logger.log('Initial polling disabled via configuration');
      return;
    }

    this.logger.log('Starting initial blockchain state data collection...');

    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

    if (blockchains.length === 0) {
      this.logger.warn('No enabled blockchains found for initial polling');
      return;
    }

    this.logger.log(
      `Found ${blockchains.length} enabled blockchain(s) for initial collection`,
    );

    let successful = 0;
    let failed = 0;

    for (const blockchain of blockchains) {
      try {
        await this.pollBlockchainSafely(blockchain, 'initial');
        successful++;
      } catch {
        failed++;
        // Error already logged in pollBlockchainSafely
      }
    }

    this.logger.log(
      `Initial state collection completed: ${successful} successful, ${failed} failed`,
    );
    this.logger.log('StateFetcherService initialized successfully');
  }

  private async pollBlockchainSafely(
    blockchain: Blockchain,
    context: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Starting ${context} state polling for blockchain ${blockchain.id}`,
      );

      this.validateBlockchainConfig(blockchain);

      const provider = await this.createProvider(blockchain);
      const stateData = await this.contractInteractionService.getContractState(
        blockchain,
        provider,
      );
      await this.stateStorageService.saveBlockchainState(blockchain, stateData);

      const duration = Date.now() - startTime;
      this.logger.log(
        `${context} state fetched for blockchain ${blockchain.id} (${duration}ms)`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Error during ${context} state polling for blockchain ${blockchain.id} (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (this.config.enableMetrics) {
        // TODO: Record metrics when monitoring service is implemented
      }

      throw error; // Re-throw to be caught by caller for counting
    }
  }

  private validateBlockchainConfig(blockchain: Blockchain): void {
    if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
      this.logger.warn(
        `Blockchain ${blockchain.id} has missing RPC URL or contract address`,
      );
      StateFetcherErrorHelpers.throwInvalidBlockchainConfig();
    }
  }

  private async createProvider(
    blockchain: Blockchain,
  ): Promise<ethers.JsonRpcProvider> {
    try {
      this.logger.debug(
        `Creating provider for blockchain ${blockchain.id}: ${blockchain.rpcUrl}`,
      );

      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);

      // Test the connection
      const network = await provider.getNetwork();
      this.logger.debug(
        `Provider connected to network ${network.name} (chainId: ${network.chainId})`,
      );

      return provider;
    } catch (error) {
      this.logger.error(
        `Failed to create provider for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return StateFetcherErrorHelpers.throwProviderCreationFailed();
    }
  }
}
