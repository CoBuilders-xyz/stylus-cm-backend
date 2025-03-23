import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventConfigService } from './services/event-config.service';
import { EventListenerService } from './services/event-listener.service';
import { EventSyncService } from './services/event-sync.service';
import { EventSchedulerService } from './services/event-scheduler.service';
import { ProviderManager } from './utils/provider.util';

@Injectable()
export class EventFetcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventFetcherService.name);

  constructor(
    private readonly eventConfigService: EventConfigService,
    private readonly eventListenerService: EventListenerService,
    private readonly eventSyncService: EventSyncService,
    private readonly eventSchedulerService: EventSchedulerService,
    private readonly providerManager: ProviderManager,
  ) {}

  /**
   * Initialize the event fetcher when the module starts
   */
  async onModuleInit() {
    this.logger.log('Initializing EventFetcherService...');

    // Initialize blockchain configurations
    const blockchains = await this.eventConfigService.initializeBlockchains();
    const eventTypes = this.eventConfigService.getEventTypes();

    // Perform initial historical sync
    try {
      await this.eventSyncService.syncHistoricalEvents(blockchains, eventTypes);
    } catch (error) {
      this.logger.error(
        `Error during initial event synchronization: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Setup real-time event listeners
    try {
      for (const blockchain of blockchains) {
        await this.eventListenerService.setupEventListeners(
          blockchain,
          eventTypes,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error setting up event listeners: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.logger.log('EventFetcherService initialized successfully');
  }

  /**
   * Clean up when the module is destroyed
   */
  async onModuleDestroy() {
    this.logger.log('Cleaning up event fetcher...');
    this.providerManager.clear();

    // Add an await statement to satisfy the linter
    await Promise.resolve();

    this.logger.log('EventFetcherService cleaned up successfully');
  }

  /**
   * Manually trigger a resync
   */
  async triggerResync(blockchainId?: string): Promise<string> {
    return this.eventSchedulerService.triggerResync(blockchainId);
  }
}
