import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { abi } from '../common/abis/cacheManager/cacheManager.json';
import { StateFetcherConfig } from './state-fetcher.config';
import { StateFetcherErrorHelpers } from './state-fetcher.errors';
import { BlockchainStateData, ContractEntry } from './interfaces';
import { STATE_FETCHER_CONSTANTS } from './constants';

@Injectable()
export class StateFetcherService implements OnModuleInit {
  private readonly logger = new Logger(StateFetcherService.name);
  private readonly config: StateFetcherConfig;

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    private readonly configService: ConfigService,
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
      const stateData = await this.pollMetrics(blockchain, provider);
      await this.saveBlockchainState(blockchain, stateData);

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

  private async pollMetrics(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
  ): Promise<BlockchainStateData> {
    try {
      const cacheManagerContract = new ethers.Contract(
        blockchain.cacheManagerAddress,
        abi as ethers.InterfaceAbi,
        provider,
      );

      const results = await Promise.all([
        cacheManagerContract.getEntries() as Promise<ContractEntry[]>,
        cacheManagerContract.decay() as Promise<ethers.BigNumberish>,
        cacheManagerContract.cacheSize() as Promise<ethers.BigNumberish>,
        cacheManagerContract.queueSize() as Promise<ethers.BigNumberish>,
        cacheManagerContract.isPaused() as Promise<boolean>,
        provider.getBlock('latest'),
      ]);

      const [entries, decayRate, cacheSize, queueSize, isPaused, block] =
        results;

      if (!block) {
        StateFetcherErrorHelpers.throwBlockFetchFailed();
      }

      const stateData: BlockchainStateData = {
        entries,
        decayRate,
        cacheSize,
        queueSize,
        isPaused,
        blockNumber: block!.number,
        blockTimestamp: new Date(Number(block!.timestamp) * 1000),
        totalContractsCached: entries.length,
      };

      this.logger.verbose('Fetched smart contract state values', {
        blockchainId: blockchain.id,
        entries: entries.length,
        decayRate: decayRate.toString(),
        cacheSize: cacheSize.toString(),
        queueSize: queueSize.toString(),
        isPaused,
        blockNumber: block!.number,
        blockTimestamp: stateData.blockTimestamp,
      });

      return stateData;
    } catch (error) {
      this.logger.error(
        `Contract call failed for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return StateFetcherErrorHelpers.throwContractCallFailed();
    }
  }

  private async saveBlockchainState(
    blockchain: Blockchain,
    stateData: BlockchainStateData,
  ): Promise<void> {
    try {
      const newPoll = this.blockchainStateRepository.create({
        blockchain,
        minBid: STATE_FETCHER_CONSTANTS.DEFAULT_MIN_BID,
        decayRate: stateData.decayRate.toString(),
        cacheSize: stateData.cacheSize.toString(),
        queueSize: stateData.queueSize.toString(),
        isPaused: stateData.isPaused,
        blockNumber: stateData.blockNumber,
        blockTimestamp: stateData.blockTimestamp,
        totalContractsCached: stateData.totalContractsCached.toString(),
      });

      await this.blockchainStateRepository.save(newPoll);
      this.logger.debug(`State values saved for blockchain ${blockchain.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to save state for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      StateFetcherErrorHelpers.throwStateSaveFailed();
    }
  }
}
