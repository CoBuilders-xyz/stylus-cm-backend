import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventStorageService } from './event-storage.service';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { EthersEvent } from '../interfaces';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../../blockchains/entities/blockchain-event.entity';
import { createModuleLogger } from '../../../common/utils/logger.util';
import { MODULE_NAME } from '../../constants/module.constants';

@Injectable()
export class EventProcessorService {
  private readonly logger = createModuleLogger(
    EventProcessorService,
    MODULE_NAME,
  );

  constructor(
    private readonly eventStorageService: EventStorageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Process a single blockchain event
   */
  async processEvent(
    blockchain: Blockchain,
    eventLog: EthersEvent,
    provider: ethers.JsonRpcProvider,
    eventType: string,
    eventData?: Record<string, any>,
  ): Promise<void> {
    try {
      // Check for duplicates first
      if (await this.isDuplicateEvent(blockchain, eventLog, eventType)) {
        this.logger.debug(
          `Skipping duplicate ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
        );
        return;
      }

      // Process and store the event
      await this.storeEvent(
        blockchain,
        eventLog,
        provider,
        eventType,
        eventData,
      );

      // Update blockchain sync status
      await this.updateSyncStatus(blockchain, eventLog.blockNumber);

      // Emit event for other modules
      await this.emitEventStored(blockchain, eventLog);

      this.logger.log(
        `Successfully processed real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to process real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}: ${err.message}`,
        err.stack,
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

        await this.storeEvent(blockchain, eventLog, provider, eventType);
        await this.updateSyncStatus(blockchain, eventLog.blockNumber);
        await this.emitEventStored(blockchain, eventLog);

        processed++;
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to process batch event ${eventType} on blockchain ${blockchain.id}: ${err.message}`,
          err.stack,
        );
        errors++;
      }
    }

    this.logger.log(
      `Successfully batch processed ${events.length} events on blockchain ${blockchain.id} - Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`,
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
      const err = error as Error;
      this.logger.error(
        `Failed to check for duplicate event on blockchain ${blockchain.id}: ${err.message}`,
        err.stack,
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
    eventType: string,
    eventData?: Record<string, any>,
  ): Promise<void> {
    try {
      // Prepare and store the event
      const eventDataArray = await this.eventStorageService.prepareEvents(
        blockchain,
        [eventLog],
        provider,
        true, // isRealTime
        eventType,
        eventData,
      );

      await this.eventStorageService.storeEvents(eventDataArray);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to store event on blockchain ${blockchain.id}: ${err.message}`,
        err.stack,
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
      const err = error as Error;
      this.logger.error(
        `Failed to update sync status for blockchain ${blockchain.id}: ${err.message}`,
        err.stack,
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
          `No event found for blockchain ${blockchain.id} after storage at block ${eventLog.blockNumber}`,
        );
        return;
      }

      // Emit the event for other modules to consume
      this.eventEmitter.emit('blockchain.event.stored', {
        blockchainId: blockchain.id,
        eventId: event.id,
      });

      this.logger.debug(
        `Successfully emitted blockchain.event.stored for event ${event.id} on blockchain ${blockchain.id}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to emit event stored notification for blockchain ${blockchain.id}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
