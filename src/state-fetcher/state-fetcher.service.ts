import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { abi } from '../constants/abis/cacheManager/cacheManager.json';

@Injectable()
export class StateFetcherService implements OnModuleInit {
  private readonly logger = new Logger(StateFetcherService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainState)
    private readonly BlockchainStateRepository: Repository<BlockchainState>,
  ) {}

  async onModuleInit() {
    this.logger.log('Checking for initial blockchain state data...');
    const blockchains = await this.blockchainRepository.find();

    for (const blockchain of blockchains) {
      if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
        this.logger.warn(
          `Cannot fetch initial state for blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
        );
        continue;
      }

      try {
        const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
        await this.pollMetrics(blockchain, provider);
        this.logger.log(
          `Initial state fetched for blockchain ${blockchain.id}`,
        );
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            `Error fetching initial state for blockchain ${blockchain.id}: ${error.message}`,
          );
        } else {
          this.logger.error(
            `Error fetching initial state for blockchain ${blockchain.id}: Unknown error`,
          );
        }
      }
    }

    this.logger.log('Initial state check completed.');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    const blockchains = await this.blockchainRepository.find();
    for (const blockchain of blockchains) {
      if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
        this.logger.warn(
          `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
        );
        continue;
      }

      try {
        const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
        await this.pollMetrics(blockchain, provider);
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            `Error polling blockchain ${blockchain.id}: ${error.message}`,
          );
        } else {
          this.logger.error(
            `Error polling blockchain ${blockchain.id}: Unknown error`,
          );
        }
      }
    }
  }

  async pollMetrics(blockchain: Blockchain, provider: ethers.JsonRpcProvider) {
    const cacheManagerContract = new ethers.Contract(
      blockchain.cacheManagerAddress,
      abi as ethers.InterfaceAbi,
      provider,
    );

    const results = await Promise.all([
      cacheManagerContract.getEntries() as Promise<
        Array<{
          code: string;
          size: ethers.BigNumberish;
          bid: ethers.BigNumberish;
        }>
      >,
      cacheManagerContract.decay() as Promise<ethers.BigNumberish>,
      cacheManagerContract.cacheSize() as Promise<ethers.BigNumberish>,
      cacheManagerContract.queueSize() as Promise<ethers.BigNumberish>,
      cacheManagerContract.isPaused() as Promise<boolean>,
      provider.getBlock('latest'),
    ]);

    const entries = results[0];
    const decayRate = results[1];
    const cacheSize = results[2];
    const queueSize = results[3];
    const isPaused = results[4];
    const block = results[5];

    this.logger.verbose('Fetched smart contract state values', {
      entries: entries.length,
      decayRate,
      cacheSize,
      queueSize,
      isPaused,
      blockNumber: block?.number,
      blockTimestamp: new Date(Number(block?.timestamp) * 1000),
    });

    const newPoll = this.BlockchainStateRepository.create({
      blockchain,
      minBid: '0',
      decayRate: decayRate.toString(),
      cacheSize: cacheSize.toString(),
      queueSize: queueSize.toString(),
      isPaused,
      blockNumber: block?.number,
      blockTimestamp: new Date(Number(block?.timestamp) * 1000),
      totalContractsCached: entries.length.toString(),
    });

    await this.BlockchainStateRepository.save(newPoll);
    this.logger.debug(`State values saved for blockchain ${blockchain.id}`);
  }
}
