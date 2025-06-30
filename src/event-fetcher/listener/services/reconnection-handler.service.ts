import { Injectable, Logger } from '@nestjs/common';
import { ListenerStateService } from './listener-state.service';
import { ReconnectionCallbacks, BlockchainConfig } from '../interfaces';
import { EventFetcherErrorHelpers } from '../../event-fetcher.errors';

@Injectable()
export class ReconnectionHandlerService {
  private readonly logger = new Logger(ReconnectionHandlerService.name);
  private callbacks: ReconnectionCallbacks | null = null;

  constructor(private readonly listenerState: ListenerStateService) {}

  /**
   * Register callbacks for reconnection operations
   */
  registerCallbacks(callbacks: ReconnectionCallbacks): void {
    this.callbacks = callbacks;
    this.logger.debug('Reconnection callbacks registered');
  }

  /**
   * Handle reconnection for a specific blockchain
   */
  async handleReconnection(blockchainId: string): Promise<void> {
    this.logger.log(`Handling reconnection for blockchain ${blockchainId}`);

    if (!this.callbacks) {
      this.logger.error('Reconnection callbacks not registered');
      EventFetcherErrorHelpers.throwReconnectionCallbacksNotRegistered();
      return;
    }

    // Get stored configuration for this blockchain
    const config = this.listenerState.getBlockchainConfig(blockchainId);
    if (!config) {
      this.logger.warn(
        `No configuration found for blockchain ${blockchainId}, skipping reconnection`,
      );
      return;
    }

    try {
      // Validate state before reconnection
      this.validateReconnectionState(blockchainId, config);

      // Clear the active listener status to allow reconnection
      this.callbacks.clearActiveListener(blockchainId);

      // Attempt to reconnect
      await this.callbacks.setupEventListeners(
        config.blockchain,
        config.eventTypes,
      );

      this.logger.log(
        `Successfully reconnected event listeners for blockchain ${blockchainId}`,
      );

      // Validate state after reconnection
      this.validatePostReconnectionState(blockchainId);
    } catch (error) {
      this.logger.error(
        `Failed to reconnect event listeners for blockchain ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Clean up failed reconnection state
      this.cleanupFailedReconnection(blockchainId);

      throw error; // Re-throw to trigger exponential backoff
    }
  }

  /**
   * Get reconnection status for all blockchains
   */
  getReconnectionStatus(): {
    activeListeners: string[];
    configuredBlockchains: string[];
    potentialReconnections: string[];
  } {
    const stateSummary = this.listenerState.getStateSummary();

    // Find blockchains that have configs but are not active (potential reconnections needed)
    const potentialReconnections = stateSummary.configuredBlockchains.filter(
      (id) => !stateSummary.activeListeners.includes(id),
    );

    return {
      activeListeners: stateSummary.activeListeners,
      configuredBlockchains: stateSummary.configuredBlockchains,
      potentialReconnections,
    };
  }

  /**
   * Force reconnection for a specific blockchain (manual trigger)
   */
  async forceReconnection(blockchainId: string): Promise<void> {
    this.logger.log(
      `Force reconnection triggered for blockchain ${blockchainId}`,
    );

    try {
      await this.handleReconnection(blockchainId);
    } catch (error) {
      this.logger.error(
        `Force reconnection failed for blockchain ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Batch reconnection for multiple blockchains
   */
  async reconnectAll(): Promise<{ success: string[]; failed: string[] }> {
    const status = this.getReconnectionStatus();
    const success: string[] = [];
    const failed: string[] = [];

    this.logger.log(
      `Attempting batch reconnection for ${status.potentialReconnections.length} blockchains`,
    );

    for (const blockchainId of status.potentialReconnections) {
      try {
        await this.forceReconnection(blockchainId);
        success.push(blockchainId);
      } catch (error) {
        failed.push(blockchainId);
        this.logger.error(
          `Batch reconnection failed for ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Batch reconnection completed - Success: ${success.length}, Failed: ${failed.length}`,
    );

    return { success, failed };
  }

  /**
   * Validate state before attempting reconnection
   */
  private validateReconnectionState(
    blockchainId: string,
    config: BlockchainConfig,
  ): void {
    if (!config.blockchain) {
      EventFetcherErrorHelpers.throwInvalidBlockchainConfig();
    }

    if (!config.eventTypes || !Array.isArray(config.eventTypes)) {
      EventFetcherErrorHelpers.throwInvalidEventTypes();
    }

    this.logger.debug(
      `Reconnection state validated for blockchain ${blockchainId}`,
    );
  }

  /**
   * Validate state after successful reconnection
   */
  private validatePostReconnectionState(blockchainId: string): void {
    const isActive = this.listenerState.isListenerActive(blockchainId);

    if (!isActive) {
      this.logger.warn(
        `Blockchain ${blockchainId} reconnection completed but listener not marked as active`,
      );
    } else {
      this.logger.debug(
        `Post-reconnection state validated for blockchain ${blockchainId}`,
      );
    }
  }

  /**
   * Clean up state after failed reconnection
   */
  private cleanupFailedReconnection(blockchainId: string): void {
    try {
      // Ensure listener is not marked as active after failure
      this.listenerState.clearListener(blockchainId);

      // Note: We keep the blockchain config for future reconnection attempts
      this.logger.debug(
        `Cleaned up failed reconnection state for blockchain ${blockchainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error during reconnection cleanup for ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
