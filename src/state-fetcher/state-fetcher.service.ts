import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { StateFetcherConfig } from './state-fetcher.config';
import { StateFetcherErrorHelpers } from './state-fetcher.errors';
import { ContractInteractionService, StateStorageService } from './services';

@Injectable()
export class StateFetcherService implements OnModuleInit {
  private readonly logger = new Logger(StateFetcherService.name);
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
    this.logger.debug('Starting scheduled blockchain state polling...');
    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

    const pollingPromises = blockchains.map((blockchain) =>
      this.pollBlockchainSafely(blockchain, 'scheduled'),
    );

    await Promise.allSettled(pollingPromises);
    this.logger.debug('Scheduled polling completed.');
  }

  async onModuleInit() {
    if (!this.config.enableInitialPolling) {
      this.logger.log('Initial polling disabled via configuration');
      return;
    }

    this.logger.log('Starting initial blockchain state data collection...');
    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

    for (const blockchain of blockchains) {
      await this.pollBlockchainSafely(blockchain, 'initial');
    }

    this.logger.log('Initial state check completed.');
  }

  private async pollBlockchainSafely(
    blockchain: Blockchain,
    context: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.validateBlockchainConfig(blockchain);

      const provider = await this.createProvider(blockchain);
      const stateData = await this.contractInteractionService.getContractState(
        blockchain,
        provider,
      );
      await this.stateStorageService.saveBlockchainState(blockchain, stateData);

      const duration = Date.now() - startTime;
      this.logger.log(
        `${context} state fetched for blockchain ${blockchain.id} in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Error during ${context} state polling for blockchain ${blockchain.id} (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      if (this.config.enableMetrics) {
        // TODO: Record metrics when monitoring service is implemented
      }
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
      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);

      // Test the connection
      await provider.getNetwork();

      return provider;
    } catch (error) {
      this.logger.error(
        `Failed to create provider for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return StateFetcherErrorHelpers.throwProviderCreationFailed();
    }
  }
}
