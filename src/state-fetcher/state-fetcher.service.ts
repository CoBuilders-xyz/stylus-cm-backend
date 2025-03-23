import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../blockchains/entities/blockchain-state.entity';
import { abi } from '../constants/abis/cacheManager/cacheManager.json';

@Injectable()
export class StateFetcherService {
  private readonly logger = new Logger(StateFetcherService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainState)
    private readonly BlockchainStateRepository: Repository<BlockchainState>,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    this.logger.debug('Polling real-time blockchain metrics...');
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
      cacheManagerContract['getMinBid(uint64)'](
        process.env.CONTRACT_SMALL_SIZE,
      ) as Promise<ethers.BigNumberish>,
      cacheManagerContract['getMinBid(uint64)'](
        process.env.CONTRACT_MID_SIZE,
      ) as Promise<ethers.BigNumberish>,
      cacheManagerContract['getMinBid(uint64)'](
        process.env.CONTRACT_LARGE_SIZE,
      ) as Promise<ethers.BigNumberish>,
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

    const minBidSmallSize = results[0];
    const minBidMidSize = results[1];
    const minBidLargeSize = results[2];
    const entries = results[3];
    const decayRate = results[4];
    const cacheSize = results[5];
    const queueSize = results[6];
    const isPaused = results[7];
    const block = results[8];

    this.logger.log({
      minBidSmallSize,
      minBidMidSize,
      minBidLargeSize,
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
    this.logger.log(`Metrics saved for blockchain ${blockchain.id}`);
  }
}
