import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { WebSocketManagerService } from './websocket-manager.service';
import { ListenerStateService } from './listener-state.service';
import { EventProcessorService } from '../../shared';
import { ReconnectionHandlerService } from './reconnection-handler.service';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import {
  ProviderManager,
  ReconnectionCallback,
} from '../../../common/utils/provider.util';
import { EthersEvent } from '../../shared';

@Injectable()
export class EventListenerService {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(
    private readonly websocketManager: WebSocketManagerService,
    private readonly listenerState: ListenerStateService,
    private readonly eventProcessor: EventProcessorService,
    private readonly reconnectionHandler: ReconnectionHandlerService,
    private readonly providerManager: ProviderManager,
  ) {
    // Register callbacks for reconnection handler
    this.reconnectionHandler.registerCallbacks({
      setupEventListeners: (blockchain: Blockchain, eventTypes: string[]) =>
        this.setupEventListeners(blockchain, eventTypes),
      clearActiveListener: (blockchainId: string) =>
        this.clearActiveListener(blockchainId),
    });

    // Register this service for reconnection callbacks
    this.providerManager.registerReconnectionCallback(this.handleReconnection);
  }

  /**
   * Clears active listener tracking for a blockchain (used by ProviderManager)
   */
  clearActiveListener(blockchainId: string): void {
    this.listenerState.clearListener(blockchainId);
    this.logger.debug(
      `Cleared active listener status for blockchain ${blockchainId}`,
    );
  }

  /**
   * Manually restart event listeners for a blockchain
   */
  async restartEventListeners(
    blockchain: Blockchain,
    eventTypes: string[],
  ): Promise<void> {
    this.logger.log(
      `Restarting event listeners for blockchain ${blockchain.id}`,
    );

    // ✅ Clear any existing state first
    this.listenerState.clearListener(blockchain.id);
    this.listenerState.removeBlockchainConfig(blockchain.id);

    // ✅ Then use the normal setup process with race protection
    await this.setupEventListeners(blockchain, eventTypes);
  }

  /**
   * Sets up event listeners for a blockchain
   */
  async setupEventListeners(
    blockchain: Blockchain,
    eventTypes: string[],
  ): Promise<void> {
    // Use WebSocketManager to validate configuration
    if (!this.websocketManager.validateWebSocketConfig(blockchain)) {
      this.logger.warn(
        `Skipping event listener setup for blockchain ${blockchain.id} due to missing WebSocket URL or contract address`,
      );
      return;
    }

    // ✅ Atomic check and mark setup - prevents race conditions
    if (!this.listenerState.markSettingUpListener(blockchain.id)) {
      this.logger.log(
        `Event listeners already set up or being set up for blockchain ${blockchain.id}, skipping`,
      );
      return;
    }

    // Store configuration for reconnection
    this.listenerState.storeBlockchainConfig(blockchain.id, {
      blockchain,
      eventTypes,
    });

    try {
      // We still need a regular HTTP provider for transaction lookups and other RPC calls
      const httpProvider = this.providerManager.getProvider(blockchain);

      // Use WebSocketManager to create WebSocket contracts
      const webSocketContracts =
        this.websocketManager.createWebSocketContracts(blockchain);

      // Setup a single listener for all events using WebSocket connections
      await this.setupSingleEventListener(
        blockchain,
        webSocketContracts.cacheManagerContract,
        eventTypes,
        httpProvider,
      );
      await this.setupSingleEventListener(
        blockchain,
        webSocketContracts.cacheManagerAutomationContract,
        eventTypes,
        httpProvider,
      );

      // ✅ Complete setup - moves from "setting up" to "active"
      this.listenerState.setListenerActive(blockchain.id);

      this.logger.log(
        `Successfully set up WebSocket-based event listeners for blockchain ${blockchain.id}`,
      );
    } catch (error) {
      // ✅ Clean up both config and setup state if setup failed
      this.listenerState.removeBlockchainConfig(blockchain.id);
      this.listenerState.clearListener(blockchain.id); // This clears setup state too

      const err = error as Error;
      this.logger.error(
        `Failed to setup WebSocket event listeners for blockchain ${blockchain.id}: ${err.message}`,
        err.stack,
      );

      // Re-throw the error so reconnection logic can handle it
      throw error;
    }
  }

  /**
   * Cleanup method to unregister reconnection callback
   */
  onDestroy(): void {
    this.providerManager.unregisterReconnectionCallback(
      this.handleReconnection,
    );
    this.logger.log('Successfully cleaned up EventListenerService');
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
            `Ignoring event ${eventType} on blockchain ${blockchain.id} as it's not in tracked events list`,
          );
          return;
        }

        this.logger.debug(
          `Received real-time ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}`,
        );

        // Use a unique key to track if we've already started processing this event
        const eventKey = `${blockchain.id}_${eventLog.blockNumber}_${eventLog.index}_${eventType}`;

        // Check if we're already processing this event
        if (this.listenerState.isEventProcessing(eventKey)) {
          this.logger.debug(
            `Event ${eventType} at block ${eventLog.blockNumber} on blockchain ${blockchain.id} is already being processed, skipping duplicate`,
          );
          return;
        }

        // Mark this event as being processed
        this.listenerState.markEventProcessing(eventKey);

        // Handle the async operations separately with proper error handling
        void this.eventProcessor
          .processEvent(blockchain, eventLog, provider, eventType)
          .catch((err) => {
            const error = err as Error;
            this.logger.error(
              `Failed to process ${eventType} event on blockchain ${blockchain.id} at block ${eventLog.blockNumber}: ${error.message}`,
              error.stack,
            );
          })
          .finally(() => {
            // Remove the event from the processing set when done
            this.listenerState.unmarkEventProcessing(eventKey);
          });
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to handle event on blockchain ${blockchain.id}: ${err.message}`,
          err.stack,
        );
      }
    });

    this.logger.log(
      `Successfully subscribed to all events for blockchain ${blockchain.id}`,
    );
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
   * Handles reconnection attempts for a specific blockchain
   */
  private handleReconnection: ReconnectionCallback = async (
    blockchainId: string,
  ) => {
    await this.reconnectionHandler.handleReconnection(blockchainId);
  };
}
