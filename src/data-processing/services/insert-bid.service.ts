import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import {
  calculateActualBid,
  updateTotalBidInvestment,
} from '../utils/bid-utils';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { EventDataGuards } from '../interfaces/event-data.interface';
import { DEFAULT_VALUES } from '../constants/event-processing.constants';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class InsertBidService {
  private readonly logger = createModuleLogger(
    InsertBidService,
    'DataProcessing',
  );

  constructor(
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Process an InsertBid event and update the contract bytecode state map
   *
   * @param event The InsertBid event to process
   * @param contractBytecodeStates Map of contract bytecode states to update
   * @param decayRate Current decay rate to apply
   */
  async processInsertBidEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing InsertBid event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      // Validate event data using type guards
      if (!EventDataGuards.isInsertBidEventData(eventDataArray)) {
        this.logger.warn(
          `InsertBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'InsertBid',
          event.eventData,
        );
        return;
      }

      const [bytecodeHash, address, bidValue, size] = eventDataArray;
      const bidBlockNumber = event.blockNumber;
      const bidBlockTimestamp = event.blockTimestamp;

      // Get the applicable decay rate
      const applicableDecayRate = await this.getApplicableDecayRate(
        blockchain,
        event,
      );

      // Calculate actual bid with decay
      const actualBid = calculateActualBid(
        bidValue,
        applicableDecayRate,
        event.blockTimestamp,
      );

      this.logger.debug(
        `Processing InsertBid for bytecode ${bytecodeHash} at address ${address} with bid ${bidValue} and size ${size}`,
      );

      // Process bytecode
      await this.processBytecode(
        blockchain,
        bytecodeHash,
        size,
        actualBid,
        bidValue,
        bidBlockNumber,
        bidBlockTimestamp,
      );

      // Process contract
      await this.processContract(
        blockchain,
        address,
        bytecodeHash,
        actualBid,
        bidValue,
        bidBlockNumber,
        bidBlockTimestamp,
      );

      this.logger.log(
        `Successfully processed InsertBid event for bytecode ${bytecodeHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing InsertBid event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'InsertBid',
      );
    }
  }

  /**
   * Get the applicable decay rate for the event
   */
  private async getApplicableDecayRate(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<string> {
    try {
      // Get the last blockchain state
      const blockchainState = await this.blockchainStateRepository.findOne({
        where: { blockchain: { id: blockchain.id } },
        order: { blockNumber: 'DESC' },
      });
      const lastBidDecayRate =
        blockchainState?.decayRate ?? DEFAULT_VALUES.DECAY_RATE;

      // Find decay rate events until event.blockNumber
      const mostRecentDecayRateEvent =
        await this.blockchainEventRepository.findOne({
          where: {
            blockchain: { id: blockchain.id },
            blockNumber: LessThanOrEqual(event.blockNumber),
            eventName: 'SetDecayRate',
          },
          order: { blockNumber: 'DESC' },
        });

      // Return the applicable decay rate
      return mostRecentDecayRateEvent
        ? String(mostRecentDecayRateEvent.eventData[0])
        : lastBidDecayRate;
    } catch (error) {
      this.logger.error(
        `Error getting applicable decay rate: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'decay rate retrieval',
      );
      // This line is unreachable but satisfies TypeScript
      throw new Error('Unreachable code');
    }
  }

  /**
   * Process bytecode entity
   */
  private async processBytecode(
    blockchain: Blockchain,
    bytecodeHash: string,
    size: string,
    actualBid: string,
    bidValue: string,
    bidBlockNumber: number,
    bidBlockTimestamp: Date,
  ): Promise<void> {
    try {
      // Find existing bytecode
      const existingBytecode = await this.bytecodeRepository.findOne({
        where: { blockchain: { id: blockchain.id }, bytecodeHash },
      });

      let bytecode = new Bytecode();
      if (!existingBytecode) {
        this.logger.debug(
          `No bytecode found for ${bytecodeHash}, creating new entry`,
        );
        bytecode.blockchain = blockchain;
        bytecode.bytecodeHash = bytecodeHash;
        bytecode.size = size;
        bytecode.lastBid = actualBid;
        bytecode.bidPlusDecay = bidValue;
        bytecode.totalBidInvestment = actualBid;
        bytecode.isCached = true;
        bytecode.bidBlockNumber = bidBlockNumber;
        bytecode.bidBlockTimestamp = bidBlockTimestamp;
      } else {
        this.logger.debug(`Bytecode found for ${bytecodeHash}, updating entry`);
        bytecode = existingBytecode;
        bytecode.lastBid = actualBid;
        bytecode.bidPlusDecay = bidValue;
        bytecode.totalBidInvestment = updateTotalBidInvestment(
          existingBytecode.totalBidInvestment,
          actualBid,
        );
        bytecode.isCached = true;
        bytecode.bidBlockNumber = bidBlockNumber;
        bytecode.bidBlockTimestamp = bidBlockTimestamp;
      }

      await this.bytecodeRepository.save(bytecode);
    } catch (error) {
      this.logger.error(
        `Error processing bytecode: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed('bytecode save');
    }
  }

  /**
   * Process contract entity
   */
  private async processContract(
    blockchain: Blockchain,
    address: string,
    bytecodeHash: string,
    actualBid: string,
    bidValue: string,
    bidBlockNumber: number,
    bidBlockTimestamp: Date,
  ): Promise<void> {
    try {
      // Find existing contract
      const existingContract = await this.contractRepository.findOne({
        where: { blockchain: { id: blockchain.id }, address },
      });

      // Get the bytecode reference
      const bytecode = await this.bytecodeRepository.findOne({
        where: { blockchain: { id: blockchain.id }, bytecodeHash },
      });

      if (!bytecode) {
        this.logger.error(`Bytecode not found for contract ${address}`);
        DataProcessingErrorHelpers.throwDatabaseOperationFailed(
          'bytecode lookup for contract',
        );
        return;
      }

      let contract = new Contract();
      if (!existingContract) {
        this.logger.debug(
          `No contract found for ${address}, creating new entry`,
        );
        contract.blockchain = blockchain;
        contract.address = address;
        contract.bytecode = bytecode;
        contract.lastBid = actualBid;
        contract.bidPlusDecay = bidValue;
        contract.totalBidInvestment = actualBid;
        contract.bidBlockNumber = bidBlockNumber;
        contract.bidBlockTimestamp = bidBlockTimestamp;
      } else {
        this.logger.debug(`Contract found for ${address}, updating entry`);
        contract = existingContract;
        contract.lastBid = actualBid;
        contract.bidPlusDecay = bidValue;
        contract.totalBidInvestment = updateTotalBidInvestment(
          existingContract.totalBidInvestment,
          actualBid,
        );
        contract.bidBlockNumber = bidBlockNumber;
        contract.bidBlockTimestamp = bidBlockTimestamp;
      }

      await this.contractRepository.save(contract);
    } catch (error) {
      this.logger.error(
        `Error processing contract: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed('contract save');
    }
  }
}
