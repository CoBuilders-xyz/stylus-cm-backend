import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventListenerService } from './services/event-listener.service';
import { EventSyncService } from './services/event-sync.service';
import { EventSchedulerService } from './services/event-scheduler.service';
import { ProviderManager } from '../common/utils/provider.util';
import { BlockchainsService } from 'src/blockchains/blockchains.service';

@Injectable()
export class EventFetcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventFetcherService.name);

  constructor(
    private readonly eventListenerService: EventListenerService,
    private readonly blockchainService: BlockchainsService,
    private readonly eventSyncService: EventSyncService,
    private readonly eventSchedulerService: EventSchedulerService,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initialize the event fetcher when the module starts
   */
  async onModuleInit() {
    this.logger.log('Initializing EventFetcherService...');

    // Initialize blockchain configurations
    const blockchains = await this.blockchainService.findAll();
    const eventTypes = this.configService.get<string[]>('eventTypes') || [''];

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

    // Setup real-time event listeners (one at a time to avoid race conditions)
    try {
      for (const blockchain of blockchains) {
        this.logger.log(
          `Setting up event listeners for blockchain: ${blockchain.name} (${blockchain.id})`,
        );
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
