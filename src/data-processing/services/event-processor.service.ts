import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import { InsertBidService } from './insert-bid.service';
import { DeleteBidService } from './delete-bid.service';
import { DecayRateService } from './decay-rate.service';
import { ContractBytecodeService } from './contract-bytecode.service';
import { findApplicableDecayRate } from '../utils/event-utils';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    private readonly insertBidService: InsertBidService,
    private readonly deleteBidService: DeleteBidService,
    private readonly decayRateService: DecayRateService,
    private readonly contractBytecodeService: ContractBytecodeService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process all events for all blockchains
   */
  async processAllEvents(): Promise<void> {
    this.logger.log('Starting full event processing...');

    try {
      // Get all blockchains
      const blockchains = await this.blockchainRepository.find();

      for (const blockchain of blockchains) {
        await this.processBlockchainAllEvents(blockchain);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in full event processing: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process new events that have been created since the last processing
   */
  async processNewEvent(blockchainId: string, eventId: string): Promise<void> {
    try {
      // Get the blockchain
      const blockchain = await this.blockchainRepository.findOne({
        where: { id: blockchainId },
      });
      if (!blockchain) {
        this.logger.error(`Blockchain not found: ${blockchainId}`);
        throw new Error(`Blockchain not found: ${blockchainId}`);
      }

      const event = await this.blockchainEventRepository.findOne({
        where: { id: eventId },
      });
      if (!event) {
        this.logger.error(`Event not found: ${eventId}`);
        throw new Error(`Event not found: ${eventId}`);
      }

      await this.processBlockchainNewEvent(blockchain, event);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in new event processing: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process all events for a specific blockchain
   *
   * @param blockchain The blockchain to process events for
   */
  private async processBlockchainAllEvents(
    blockchain: Blockchain,
  ): Promise<void> {
    this.logger.log(`Processing all events for blockchain: ${blockchain.name}`);

    let events: BlockchainEvent[] = [];

    // Check if we've processed events for this blockchain before
    this.logger.debug(
      `Resuming processing from last processed  block: ${blockchain.lastProcessedBlockNumber}`,
    );

    // Load all events for blockchain sorted by block number
    events = await this.blockchainEventRepository.find({
      where: {
        blockchain: { id: blockchain.id },
        blockNumber: MoreThan(blockchain.lastProcessedBlockNumber || 0),
      },
      order: { blockNumber: 'ASC', logIndex: 'ASC' },
    });

    // Log what events were returned and count by type
    const eventsByType: Record<string, number> = {};
    events.forEach((e) => {
      eventsByType[e.eventName] = (eventsByType[e.eventName] || 0) + 1;
    });

    const eventTypeSummary = Object.entries(eventsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');

    this.logger.debug(`Query returned events by type: ${eventTypeSummary}`);

    // Process the events
    if (events.length > 0) {
      for (const event of events) {
        const eventProcessor =
          this.processEvent[event.eventName] || this.processEvent.Default;
        await eventProcessor(blockchain, event);
      }

      // Update the last processed event in the blockchain record
      await this.updateLastProcessedEvent(
        blockchain,
        events[events.length - 1],
      );
    }

    // // Verify contract bytecodes at the end of processing if needed
    // await this.contractBytecodeService.verifyContractBytecodeCacheStatus(
    //   blockchain,
    // );
  }

  /**
   * Process new events for a specific blockchain
   *
   * @param blockchain The blockchain to process events for
   */
  private async processBlockchainNewEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.log(`Processing new events for blockchain: ${blockchain.name}`);

    // We can only process new events if we have processed some events before
    if (!blockchain.lastProcessedBlockNumber) {
      this.logger.log(
        `No events have been processed yet for blockchain ${blockchain.name}. Running full processing...`,
      );
      return this.processBlockchainAllEvents(blockchain);
    }

    this.logger.debug(
      `New event query returned event by type: ${event.eventName}`,
    );
    const eventProcessor =
      this.processEvent[event.eventName] || this.processEvent.Default;
    await eventProcessor(blockchain, event);

    // Update the last processed event in the blockchain record
    await this.updateLastProcessedEvent(blockchain, event);
  }

  /**
   * Update the last processed event information in the blockchain record
   *
   * @param blockchain The blockchain to update
   * @param lastEvent The last event that was processed
   */
  private async updateLastProcessedEvent(
    blockchain: Blockchain,
    lastEvent: BlockchainEvent,
  ): Promise<void> {
    try {
      blockchain.lastProcessedBlockNumber = lastEvent.blockNumber;
      await this.blockchainRepository.save(blockchain);

      this.logger.log(
        `Updated last processed block for blockchain ${blockchain.name} to ${lastEvent.blockNumber})`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating last processed event: ${errorMessage}`);
      throw error;
    }
  }

  private processEvent = {
    InsertBid: (blockchain: Blockchain, event: BlockchainEvent) =>
      this.insertBidService.processInsertBidEvent(blockchain, event),
    DeleteBid: (blockchain: Blockchain, event: BlockchainEvent) =>
      this.deleteBidService.processDeleteBidEvent(blockchain, event),
    // SetDecayRate: (blockchain: Blockchain, event: BlockchainEvent) =>
    //   this.decayRateService.processSetDecayRateEvent2(blockchain, event),
    // SetCacheSize: (blockchain: Blockchain, event: BlockchainEvent) =>
    //   this.contractBytecodeService.processSetCacheSizeEvent2(blockchain, event),
    Default: (blockchain: Blockchain, event: BlockchainEvent) => {
      this.logger.warn(
        `No event processor defined for event ${event.eventName} on blockchain ${blockchain.id}, skipping`,
      );
    },
  };
}
