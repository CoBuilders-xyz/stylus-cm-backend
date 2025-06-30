import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventStorageService } from './event-storage.service';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { EthersEvent } from '../interfaces';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../../blockchains/entities/blockchain-event.entity';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly eventStorageService: EventStorageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Processes a received event - main entry point
   */
  async processEvent(
    blockchain: Blockchain,
    eventLog: EthersEvent,
    provider: ethers.JsonRpcProvider,
    eventType: string,
  ): Promise<void> {
    try {
      // Check for duplicates first
      if (await this.isDuplicateEvent(blockchain, eventLog, eventType)) {
        this.logger.debug(
          `Event already exists for ${eventType} on blockchain ${blockchain.id} at block ${eventLog.blockNumber}, skipping processing.`,
        );
        return;
      }

      // Process and store the event
      await this.storeEvent(blockchain, eventLog, provider);

      // Update blockchain sync status
      await this.updateSyncStatus(blockchain, eventLog.blockNumber);

      // Emit event for other modules
      await this.emitEventStored(blockchain, eventLog);

      this.logger.log(
        `Processed real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process real-time ${eventType} event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Batch process multiple events (for future use)
   */
  async processEventsBatch(
    blockchain: Blockchain,
    events: Array<{ eventLog: EthersEvent; eventType: string }>,
    provider: ethers.JsonRpcProvider,
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { eventLog, eventType } of events) {
      try {
        if (await this.isDuplicateEvent(blockchain, eventLog, eventType)) {
          skipped++;
          continue;
        }

        await this.storeEvent(blockchain, eventLog, provider);
        await this.updateSyncStatus(blockchain, eventLog.blockNumber);
        await this.emitEventStored(blockchain, eventLog);

        processed++;
      } catch (error) {
        this.logger.error(
          `Error in batch processing event: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Batch processed ${events.length} events - Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`,
    );

    return { processed, skipped, errors };
  }

  /**
   * Checks if an event is a duplicate
   */
  private async isDuplicateEvent(
    blockchain: Blockchain,
    eventLog: EthersEvent,
    eventType: string,
  ): Promise<boolean> {
    try {
      const existingEvent = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          blockNumber: eventLog.blockNumber,
          logIndex: eventLog.index,
          transactionHash: eventLog.transactionHash,
          eventName: eventType,
        },
      });

      return existingEvent !== null;
    } catch (error) {
      this.logger.error(
        `Error checking for duplicate event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Stores the event using EventStorageService
   */
  private async storeEvent(
    blockchain: Blockchain,
    eventLog: EthersEvent,
    provider: ethers.JsonRpcProvider,
  ): Promise<void> {
    try {
      // Prepare and store the event
      const eventData = await this.eventStorageService.prepareEvents(
        blockchain,
        [eventLog],
        provider,
        true, // isRealTime
      );

      await this.eventStorageService.storeEvents(eventData);
    } catch (error) {
      this.logger.error(
        `Error storing event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Updates the last synced block for the blockchain
   */
  private async updateSyncStatus(
    blockchain: Blockchain,
    blockNumber: number,
  ): Promise<void> {
    try {
      await this.eventStorageService.updateLastSyncedBlock(
        blockchain,
        blockNumber,
      );
    } catch (error) {
      this.logger.error(
        `Error updating sync status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Emits blockchain event stored notification
   */
  private async emitEventStored(
    blockchain: Blockchain,
    eventLog: EthersEvent,
  ): Promise<void> {
    try {
      // Find the stored event to get its ID
      const event = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          blockNumber: eventLog.blockNumber,
          logIndex: eventLog.index,
        },
      });

      if (!event) {
        this.logger.warn(
          `No event found for blockchain ${blockchain.id} after storage`,
        );
        return;
      }

      // Emit the event for other modules to consume
      this.eventEmitter.emit('blockchain.event.stored', {
        blockchainId: blockchain.id,
        eventId: event.id,
      });

      this.logger.debug(
        `Emitted blockchain.event.stored for event ${event.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error emitting event stored notification: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
