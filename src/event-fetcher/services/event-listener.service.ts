import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventStorageService } from './event-storage.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ProviderManager } from '../../common/utils/provider.util';
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
      const contract = this.providerManager.getContract(blockchain);
      const provider = this.providerManager.getProvider(blockchain);

      // Setup a single listener for all events
      this.setupSingleEventListener(blockchain, contract, eventTypes, provider);

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
   * Sets up a single event listener
   */
  private setupEventListener(
    blockchain: Blockchain,
    contract: ethers.Contract,
    eventType: string,
    provider: ethers.JsonRpcProvider,
  ) {
    const eventHandler = (...args: any[]): void => {
      // Extract the event data from the arguments (last item)
      const eventObj: unknown = args[args.length - 1];

      try {
        // Get the event log from the event object
        const eventLog = this.extractEventLog(eventObj);
        if (!eventLog) {
          this.logger.warn(
            `Received malformed event for ${eventType} on blockchain ${blockchain.id}`,
          );
          return;
        }

        this.logger.debug(
          `Received real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
        );

        // Handle the async operations separately with proper error handling
        void this.processEvent(blockchain, eventLog, provider, eventType).catch(
          (err) => {
            this.logger.error(
              `Error in event processing: ${err instanceof Error ? err.message : String(err)}`,
            );
          },
        );
      } catch (error) {
        this.logger.error(
          `Error processing event for ${eventType} on blockchain ${blockchain.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    try {
      // Remove existing listeners first to avoid duplicates
      try {
        contract.removeAllListeners(eventType);
        // Don't try to remove 'error' listeners from contract
        this.logger.verbose(
          `Removed existing listeners for ${eventType} on blockchain ${blockchain.id}`,
        );
      } catch (removeError) {
        this.logger.warn(
          `Failed to remove existing listeners for ${eventType} on blockchain ${blockchain.id}: ${
            removeError instanceof Error
              ? removeError.message
              : String(removeError)
          }`,
        );
      }

      contract.on(eventType, eventHandler);

      this.logger.log(
        `Subscribed to ${eventType} events for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set up event listener for ${eventType} on blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Sets up a single event listener for all event types
   */
  private setupSingleEventListener(
    blockchain: Blockchain,
    contract: ethers.Contract,
    eventTypes: string[],
    provider: ethers.JsonRpcProvider,
  ) {
    // Remove any existing listeners to avoid duplicates
    try {
      // First explicitly remove any listeners for specific events
      if (eventTypes && eventTypes.length > 0) {
        for (const eventType of eventTypes) {
          contract.removeAllListeners(eventType);
        }
      }
      // Then remove any wildcard listeners
      contract.removeAllListeners('*');
      // Finally, remove all listeners (this is a catch-all)
      contract.removeAllListeners();

      this.logger.verbose(
        `Removed all existing listeners on blockchain ${blockchain.id}`,
      );
    } catch (removeError) {
      this.logger.warn(
        `Failed to remove existing listeners on blockchain ${blockchain.id}: ${
          removeError instanceof Error
            ? removeError.message
            : String(removeError)
        }`,
      );
    }

    // Create a single event handler for all events
    contract.on('*', (event) => {
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
        const eventType = event.eventName || 'Unknown';

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

        // Handle the async operations separately with proper error handling
        void this.processEvent(blockchain, eventLog, provider, eventType).catch(
          (err) => {
            this.logger.error(
              `Error in event processing: ${err instanceof Error ? err.message : String(err)}`,
            );
          },
        );
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
