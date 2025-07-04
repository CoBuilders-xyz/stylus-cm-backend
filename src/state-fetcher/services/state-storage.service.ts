import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { StateFetcherErrorHelpers } from '../state-fetcher.errors';
import { BlockchainStateData } from '../interfaces';
import { STATE_FETCHER_CONSTANTS } from '../constants';

@Injectable()
export class StateStorageService {
  private readonly logger = new Logger(StateStorageService.name);

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
  ) {}

  async saveBlockchainState(
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

  async getLatestState(blockchainId: string): Promise<BlockchainState | null> {
    try {
      return await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { timestamp: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get latest state for blockchain ${blockchainId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
