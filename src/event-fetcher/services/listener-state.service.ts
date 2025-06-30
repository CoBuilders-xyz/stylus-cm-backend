import { Injectable, Logger } from '@nestjs/common';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';

export interface BlockchainConfig {
  blockchain: Blockchain;
  eventTypes: string[];
}

@Injectable()
export class ListenerStateService {
  private readonly logger = new Logger(ListenerStateService.name);

  // State tracking
  private readonly activeListeners = new Set<string>();
  private readonly processingEvents = new Set<string>();
  private readonly blockchainConfigs = new Map<string, BlockchainConfig>();

  /**
   * Active Listeners Management
   */
  isListenerActive(blockchainId: string): boolean {
    return this.activeListeners.has(blockchainId);
  }

  setListenerActive(blockchainId: string): void {
    this.activeListeners.add(blockchainId);
    this.logger.debug(`Set listener active for blockchain ${blockchainId}`);
  }

  clearListener(blockchainId: string): void {
    this.activeListeners.delete(blockchainId);
    this.logger.debug(`Cleared listener for blockchain ${blockchainId}`);
  }

  /**
   * Event Processing State Management
   */
  isEventProcessing(eventKey: string): boolean {
    return this.processingEvents.has(eventKey);
  }

  markEventProcessing(eventKey: string): void {
    this.processingEvents.add(eventKey);
    this.logger.debug(`Marked event as processing: ${eventKey}`);
  }

  unmarkEventProcessing(eventKey: string): void {
    this.processingEvents.delete(eventKey);
    this.logger.debug(`Unmarked event processing: ${eventKey}`);
  }

  /**
   * Blockchain Configuration Management
   */
  storeBlockchainConfig(blockchainId: string, config: BlockchainConfig): void {
    this.blockchainConfigs.set(blockchainId, config);
    this.logger.debug(`Stored config for blockchain ${blockchainId}`);
  }

  getBlockchainConfig(blockchainId: string): BlockchainConfig | null {
    return this.blockchainConfigs.get(blockchainId) || null;
  }

  removeBlockchainConfig(blockchainId: string): void {
    this.blockchainConfigs.delete(blockchainId);
    this.logger.debug(`Removed config for blockchain ${blockchainId}`);
  }

  /**
   * Utility Methods
   */
  getActiveListenersCount(): number {
    return this.activeListeners.size;
  }

  getProcessingEventsCount(): number {
    return this.processingEvents.size;
  }

  getAllActiveBlockchains(): string[] {
    return Array.from(this.activeListeners);
  }

  getAllProcessingEvents(): string[] {
    return Array.from(this.processingEvents);
  }

  /**
   * State Validation & Recovery
   */
  validateState(): boolean {
    try {
      // Check for consistency between active listeners and stored configs
      const activeListeners = this.getAllActiveBlockchains();
      const configuredBlockchains = Array.from(this.blockchainConfigs.keys());

      // Log state information for debugging
      this.logger.debug(`Active listeners: ${activeListeners.length}`);
      this.logger.debug(
        `Processing events: ${this.getProcessingEventsCount()}`,
      );
      this.logger.debug(`Stored configs: ${configuredBlockchains.length}`);

      // Basic validation - active listeners should have configs
      for (const blockchainId of activeListeners) {
        if (!this.blockchainConfigs.has(blockchainId)) {
          this.logger.warn(
            `Active listener ${blockchainId} missing configuration`,
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        `State validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /**
   * Complete state cleanup
   */
  clearAllState(): void {
    const activeCount = this.activeListeners.size;
    const processingCount = this.processingEvents.size;
    const configCount = this.blockchainConfigs.size;

    this.activeListeners.clear();
    this.processingEvents.clear();
    this.blockchainConfigs.clear();

    this.logger.log(
      `Cleared all state - Active: ${activeCount}, Processing: ${processingCount}, Configs: ${configCount}`,
    );
  }

  /**
   * Get current state summary for debugging
   */
  getStateSummary(): {
    activeListeners: string[];
    processingEvents: string[];
    configuredBlockchains: string[];
  } {
    return {
      activeListeners: this.getAllActiveBlockchains(),
      processingEvents: this.getAllProcessingEvents(),
      configuredBlockchains: Array.from(this.blockchainConfigs.keys()),
    };
  }
}
