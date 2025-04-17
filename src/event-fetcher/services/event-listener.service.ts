import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventStorageService } from './event-storage.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import {
  ContractType,
  ProviderManager,
} from '../../common/utils/provider.util';
import { EthersEvent } from '../interfaces/event.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';

@Injectable()
export class EventListenerService {
  private readonly logger = new Logger(EventListenerService.name);
  // Add a set to track which blockchains have listeners set up
  private readonly activeListeners = new Set<string>();
  // Add a set to track events being processed to prevent duplicates
  private readonly processingEvents = new Set<string>();

  constructor(
    private readonly eventStorageService: EventStorageService,
    private readonly providerManager: ProviderManager,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  /**
   * Sets up event listeners for a blockchain
   */
  async setupEventListeners(
    blockchain: Blockchain,
    eventTypes: string[],
  ): Promise<void> {
    if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
      this.logger.warn(
        `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
      );
      return;
    }

    // Check if listeners are already set up for this blockchain
    if (this.activeListeners.has(blockchain.id)) {
      this.logger.log(
        `Event listeners already set up for blockchain ${blockchain.id}, skipping.`,
      );
      return;
    }

    try {
      const cacheManagerContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER,
      );
      const cacheManagerAutomationContract = this.providerManager.getContract(
        blockchain,
        ContractType.CACHE_MANAGER_AUTOMATION,
      );
      const provider = this.providerManager.getProvider(blockchain);

      // Setup a single listener for all events
      await this.setupSingleEventListener(
        blockchain,
        cacheManagerContract,
        eventTypes,
        provider,
      );
      await this.setupSingleEventListener(
        blockchain,
        cacheManagerAutomationContract,
        eventTypes,
        provider,
      );
      // Track that we've set up listeners for this blockchain
      this.activeListeners.add(blockchain.id);

      this.logger.log(
        `Successfully set up event listener for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to setup event listener for blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Sets up a single event listener for all event types
   */
  private async setupSingleEventListener(
    blockchain: Blockchain,
    contract: ethers.Contract,
    eventTypes: string[],
    provider: ethers.JsonRpcProvider,
  ) {
    // Remove any existing listeners to avoid duplicates
    await contract.removeAllListeners();

    // Type guard for events with eventName property
    const hasEventName = (obj: unknown): obj is { eventName: string } => {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        'eventName' in obj &&
        typeof (obj as { eventName: string }).eventName === 'string'
      );
    };

    // Create a single event handler for all events
    await contract.on('*', (event: unknown) => {
      try {
        // Extract the event data
        const eventLog = this.extractEventLog(event);
        if (!eventLog) {
          this.logger.warn(
            `Received malformed event on blockchain ${blockchain.id}`,
          );
          return;
        }

        // Get the event type from the event
        let eventType = 'Unknown';
        if (hasEventName(event)) {
          eventType = event.eventName;
        }

        // Check if this is an event type we're interested in
        if (eventTypes.length > 0 && !eventTypes.includes(eventType)) {
          this.logger.debug(
            `Ignoring event ${eventType} as it's not in the list of tracked events`,
          );
          return;
        }

        this.logger.debug(
          `Received real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
        );

        // Use a unique key to track if we've already started processing this event
        const eventKey = `${blockchain.id}_${eventLog.blockNumber}_${eventLog.index}_${eventType}`;

        // Check if we're already processing this event
        if (this.processingEvents.has(eventKey)) {
          this.logger.debug(
            `Event ${eventType} at block ${eventLog.blockNumber} is already being processed, skipping duplicate`,
          );
          return;
        }

        // Mark this event as being processed
        this.processingEvents.add(eventKey);

        // Handle the async operations separately with proper error handling
        void this.processEvent(blockchain, eventLog, provider, eventType)
          .catch((err) => {
            this.logger.error(
              `Error in event processing: ${err instanceof Error ? err.message : String(err)}`,
            );
          })
          .finally(() => {
            // Remove the event from the processing set when done
            this.processingEvents.delete(eventKey);
          });
      } catch (error) {
        this.logger.error(
          `Error processing event on blockchain ${blockchain.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    this.logger.log(`Subscribed to all events for blockchain ${blockchain.id}`);
  }

  /**
   * Extracts the event log from an event object
   */
  private extractEventLog(eventObj: unknown): EthersEvent | null {
    // Define type guard functions for runtime type checking
    function isEventWithLogProperty(
      obj: unknown,
    ): obj is { log: ethers.Log | ethers.EventLog } {
      if (obj === null || typeof obj !== 'object' || !('log' in obj))
        return false;

      const log = obj.log;
      if (log === null || typeof log !== 'object' || !('blockNumber' in log))
        return false;

      const blockNumber = (log as { blockNumber: unknown }).blockNumber;
      return typeof blockNumber === 'number';
    }

    function isLogOrEventLog(
      obj: unknown,
    ): obj is ethers.Log | ethers.EventLog {
      if (obj === null || typeof obj !== 'object' || !('blockNumber' in obj))
        return false;

      const blockNumber = (obj as { blockNumber: unknown }).blockNumber;
      return typeof blockNumber === 'number';
    }

    // Process based on type
    if (isEventWithLogProperty(eventObj)) {
      return eventObj.log;
    } else if (isLogOrEventLog(eventObj)) {
      return eventObj;
    }

    return null;
  }

  /**
   * Processes a received event
   */
  private async processEvent(
    blockchain: Blockchain,
    eventLog: EthersEvent,
    provider: ethers.JsonRpcProvider,
    eventType: string,
  ): Promise<void> {
    try {
      // Check if this event already exists in the database
      const existingEvent = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          blockNumber: eventLog.blockNumber,
          logIndex: eventLog.index,
          transactionHash: eventLog.transactionHash,
          eventName: eventType,
        },
      });

      if (existingEvent) {
        this.logger.debug(
          `Event already exists for ${eventType} on blockchain ${blockchain.id} at block ${eventLog.blockNumber}, skipping processing.`,
        );
        return;
      }

      // Prepare and store the event
      const eventData = await this.eventStorageService.prepareEvents(
        blockchain,
        [eventLog],
        provider,
        true,
      );

      await this.eventStorageService.storeEvents(eventData);

      // Update the last synced block
      await this.eventStorageService.updateLastSyncedBlock(
        blockchain,
        eventLog.blockNumber,
      );

      const event = await this.blockchainEventRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          blockNumber: eventLog.blockNumber,
          logIndex: eventLog.index,
        },
      });
      if (!event) {
        this.logger.warn(`No event found for blockchain ${blockchain.id}`);
        return;
      }

      this.eventEmitter.emit('blockchain.event.stored', {
        blockchainId: blockchain.id,
        eventId: event.id,
      });

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
}
