import { Injectable, Logger } from '@nestjs/common';
import { BlockchainConfig } from '../interfaces';

@Injectable()
export class ListenerStateService {
  private readonly logger = new Logger(ListenerStateService.name);

  // State tracking
  private readonly activeListeners = new Set<string>();
  private readonly processingEvents = new Set<string>();
  private readonly blockchainConfigs = new Map<string, BlockchainConfig>();
  private readonly settingUpListeners = new Set<string>();

  /**
   * Active Listeners Management
   */
  isListenerActive(blockchainId: string): boolean {
    return this.activeListeners.has(blockchainId);
  }

  /**
   * Check if listener setup is in progress (prevents race conditions)
   */
  isSettingUpListener(blockchainId: string): boolean {
    return this.settingUpListeners.has(blockchainId);
  }

  /**
   * Mark listener setup as starting (prevents concurrent setup)
   */
  markSettingUpListener(blockchainId: string): boolean {
    if (
      this.settingUpListeners.has(blockchainId) ||
      this.activeListeners.has(blockchainId)
    ) {
      return false; // Already setting up or active
    }
    this.settingUpListeners.add(blockchainId);
    this.logger.debug(
      `Marked listener setup in progress for blockchain ${blockchainId}`,
    );
    return true; // Successfully marked as setting up
  }

  /**
   * Complete listener setup (move from "setting up" to "active")
   */
  setListenerActive(blockchainId: string): void {
    this.settingUpListeners.delete(blockchainId); // Remove from setup state
    this.activeListeners.add(blockchainId);
    this.logger.debug(`Set listener active for blockchain ${blockchainId}`);
  }

  clearListener(blockchainId: string): void {
    this.settingUpListeners.delete(blockchainId); // Clear setup state
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
      const settingUpListeners = Array.from(this.settingUpListeners);
      const configuredBlockchains = Array.from(this.blockchainConfigs.keys());

      // Log state information for debugging
      this.logger.debug(`Active listeners: ${activeListeners.length}`);
      this.logger.debug(`Setting up listeners: ${settingUpListeners.length}`);
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

      // Validation - setting up listeners should have configs
      for (const blockchainId of settingUpListeners) {
        if (!this.blockchainConfigs.has(blockchainId)) {
          this.logger.warn(
            `Setting up listener ${blockchainId} missing configuration`,
          );
          return false;
        }
      }

      // Validation - no blockchain should be both active and setting up
      for (const blockchainId of activeListeners) {
        if (this.settingUpListeners.has(blockchainId)) {
          this.logger.warn(
            `Blockchain ${blockchainId} is both active and setting up - inconsistent state`,
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
    const settingUpCount = this.settingUpListeners.size;

    this.activeListeners.clear();
    this.processingEvents.clear();
    this.blockchainConfigs.clear();
    this.settingUpListeners.clear();

    this.logger.log(
      `Cleared all state - Active: ${activeCount}, Processing: ${processingCount}, Configs: ${configCount}, Setting up: ${settingUpCount}`,
    );
  }

  /**
   * Get current state summary for debugging
   */
  getStateSummary(): {
    activeListeners: string[];
    processingEvents: string[];
    configuredBlockchains: string[];
    settingUpListeners: string[];
  } {
    return {
      activeListeners: this.getAllActiveBlockchains(),
      processingEvents: this.getAllProcessingEvents(),
      configuredBlockchains: Array.from(this.blockchainConfigs.keys()),
      settingUpListeners: Array.from(this.settingUpListeners),
    };
  }
}
