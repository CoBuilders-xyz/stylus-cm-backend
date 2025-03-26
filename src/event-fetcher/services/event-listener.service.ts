import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { EventStorageService } from './event-storage.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ProviderManager } from '../utils/provider.util';
import { EthersEvent } from '../interfaces/event.interface';

@Injectable()
export class EventListenerService {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(
    private readonly eventStorageService: EventStorageService,
    private readonly providerManager: ProviderManager,
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

    try {
      const contract = this.providerManager.getContract(blockchain);
      const provider = this.providerManager.getProvider(blockchain);

      // Setup listeners for each event type
      for (const eventType of eventTypes) {
        await Promise.resolve(
          this.setupEventListener(blockchain, contract, eventType, provider),
        );
      }

      this.logger.log(
        `Successfully set up event listeners for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to setup event listeners for blockchain ${blockchain.id}: ${
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
  ): void {
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

        this.logger.log(
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
        this.logger.debug(
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

      // Register the event listener with error handling
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
