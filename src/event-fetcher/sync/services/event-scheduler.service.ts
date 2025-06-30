import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventConfigService } from '../../shared';
import { EventSyncService } from './event-sync.service';
import { ProviderManager } from '../../../common/utils/provider.util';

@Injectable()
export class EventSchedulerService {
  private readonly logger = new Logger(EventSchedulerService.name);

  constructor(
    private readonly eventConfigService: EventConfigService,
    private readonly eventSyncService: EventSyncService,
    private readonly providerManager: ProviderManager,
  ) {}

  /**
   * Run every hour to catch events that might have been missed
   */
  @Cron('0 * * * *')
  async periodicEventResync(): Promise<void> {
    this.logger.log('Starting periodic event resync to catch missed events');

    try {
      const blockchains = await this.eventConfigService.getBlockchains();
      const eventTypes = this.eventConfigService.getEventTypes();
      const resyncBlocksBack = this.eventConfigService.getResyncBlocksBack();

      for (const blockchain of blockchains) {
        try {
          if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
            this.logger.warn(
              `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
            );
            continue;
          }

          // Get fast sync provider for historical data
          const provider = this.providerManager.getFastSyncProvider(blockchain);

          // Get current latest block
          const latestBlock = await provider.getBlockNumber();

          // Calculate starting block for resync - look back resyncBlocksBack blocks
          const lastSyncedBlock =
            await this.eventSyncService[
              'eventStorageService'
            ].getLastSyncedBlock(blockchain);
          const resyncStartBlock = Math.max(
            0,
            lastSyncedBlock - resyncBlocksBack,
          );

          // Only proceed if we have blocks to resync
          if (resyncStartBlock >= latestBlock) {
            this.logger.log(`No blocks to resync for ${blockchain.id}`);
            continue;
          }

          // Perform targeted resync
          await this.eventSyncService.resyncBlockRange(
            blockchain,
            resyncStartBlock,
            latestBlock,
            eventTypes,
          );

          this.logger.log(
            `Completed periodic resync for blockchain ${blockchain.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Error during periodic resync for blockchain ${blockchain.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in periodic resync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Manually trigger a resync for a specific blockchain or all blockchains
   */
  async triggerResync(blockchainId?: string): Promise<string> {
    const eventTypes = this.eventConfigService.getEventTypes();

    if (blockchainId) {
      const blockchains = await this.eventConfigService.getBlockchains();
      const blockchain = blockchains.find((b) => b.id === blockchainId);

      if (blockchain && blockchain.rpcUrl) {
        // Use fast sync provider for manual resync
        const provider = this.providerManager.getFastSyncProvider(blockchain);
        await this.eventSyncService.syncBlockchainEvents(
          blockchain,
          provider,
          eventTypes,
        );
        return `Resynchronized events for blockchain ${blockchainId}`;
      } else {
        throw new Error(
          `Blockchain with ID ${blockchainId} not found or has no RPC URL`,
        );
      }
    } else {
      // Resync all blockchains
      const blockchains = await this.eventConfigService.getBlockchains();
      await this.eventSyncService.syncHistoricalEvents(blockchains, eventTypes);
      return 'Resynchronized events for all blockchains';
    }
  }
}
