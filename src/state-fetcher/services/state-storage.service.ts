import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { StateFetcherErrorHelpers } from '../state-fetcher.errors';
import { BlockchainStateData } from '../interfaces';
import { STATE_FETCHER_CONSTANTS } from '../constants';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';

@Injectable()
export class StateStorageService {
  private readonly logger = createModuleLogger(
    StateStorageService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
  ) {}

  async saveBlockchainState(
    blockchain: Blockchain,
    stateData: BlockchainStateData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Saving state for blockchain ${blockchain.id} at block ${stateData.blockNumber}`,
      );

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

      this.logger.log(
        `State saved for blockchain ${blockchain.id} at block ${stateData.blockNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save state for blockchain ${blockchain.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      StateFetcherErrorHelpers.throwStateSaveFailed();
    }
  }

  async getLatestState(blockchainId: string): Promise<BlockchainState | null> {
    try {
      this.logger.debug(`Fetching latest state for blockchain ${blockchainId}`);

      const latestState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchainId } },
        order: { timestamp: 'DESC' },
      });

      if (latestState) {
        this.logger.debug(
          `Found latest state for blockchain ${blockchainId} at block ${latestState.blockNumber}`,
        );
      } else {
        this.logger.debug(`No state found for blockchain ${blockchainId}`);
      }

      return latestState;
    } catch (error) {
      this.logger.error(
        `Failed to get latest state for blockchain ${blockchainId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
