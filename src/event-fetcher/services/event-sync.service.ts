import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { EventStorageService } from './event-storage.service';
import { ProviderManager } from '../utils/provider.util';
import { EthersEvent } from '../interfaces/event.interface';

@Injectable()
export class EventSyncService {
  private readonly logger = new Logger(EventSyncService.name);

  constructor(
    private readonly eventStorageService: EventStorageService,
    private readonly providerManager: ProviderManager,
  ) {}

  /**
   * Synchronizes historical events for all blockchains
   */
  async syncHistoricalEvents(
    blockchains: Blockchain[],
    eventTypes: string[],
  ): Promise<void> {
    this.logger.log('Starting historical event synchronization...');

    for (const blockchain of blockchains) {
      if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
        this.logger.warn(
          `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
        );
        continue;
      }

      try {
        const provider = this.providerManager.getProvider(blockchain);
        await this.syncBlockchainEvents(blockchain, provider, eventTypes);
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            `Error syncing blockchain ${blockchain.id}: ${error.message}`,
          );
        } else {
          this.logger.error(
            `Error syncing blockchain ${blockchain.id}: Unknown error`,
          );
        }
      }
    }

    this.logger.log('Completed historical event synchronization.');
  }

  /**
   * Synchronizes historical events for a specific blockchain
   */
  async syncBlockchainEvents(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
    eventTypes: string[],
  ): Promise<void> {
    const cacheManagerContract = this.providerManager.getContract(blockchain);

    // Get last processed block for this blockchain
    const lastSyncedBlock =
      await this.eventStorageService.getLastSyncedBlock(blockchain);
    const latestBlock = await provider.getBlockNumber();

    if (lastSyncedBlock >= latestBlock) {
      this.logger.log(`Blockchain ${blockchain.id} is already up to date.`);
      return;
    }

    this.logger.log(
      `Fetching events for blockchain ${blockchain.id} from block ${lastSyncedBlock} to ${latestBlock}...`,
    );

    // Fetch events for all event types
    const allEvents = await this.fetchEvents(
      cacheManagerContract,
      eventTypes,
      lastSyncedBlock,
      latestBlock,
    );

    if (allEvents.length === 0) {
      this.logger.log(
        `No new events found from ${lastSyncedBlock} to ${latestBlock}...`,
      );

      // Update the lastSyncedBlock even if no events were found
      await this.eventStorageService.updateLastSyncedBlock(
        blockchain,
        latestBlock,
      );
      return;
    }

    // Prepare and store events
    const eventData = await this.eventStorageService.prepareEvents(
      blockchain,
      allEvents,
      provider,
    );
    await this.eventStorageService.storeEvents(eventData);

    this.logger.log(
      `Saved ${allEvents.length} events from ${lastSyncedBlock} to ${latestBlock}...`,
    );

    // Update the lastSyncedBlock after successfully processing events
    await this.eventStorageService.updateLastSyncedBlock(
      blockchain,
      latestBlock,
    );

    this.logger.log(
      `Finished historical event synchronization for blockchain ${blockchain.id}.`,
    );
  }

  /**
   * Fetches events of specific types within a block range
   */
  private async fetchEvents(
    contract: ethers.Contract,
    eventTypes: string[],
    fromBlock: number,
    toBlock: number,
  ): Promise<EthersEvent[]> {
    let allEvents: EthersEvent[] = [];

    this.logger.log(`Querying events from ${fromBlock} to ${toBlock}...`);

    for (const eventType of eventTypes) {
      const eventFilter = contract.filters[eventType]();
      try {
        const events = await contract.queryFilter(
          eventFilter,
          fromBlock,
          toBlock,
        );

        if (events.length > 0) {
          this.logger.log(
            `Found ${events.length} ${eventType} events from ${fromBlock} to ${toBlock}`,
          );
          allEvents = [...allEvents, ...events];
        }
      } catch (error) {
        this.logger.error(
          `Error fetching ${eventType} events: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return allEvents;
  }

  /**
   * Resyncs events for a specific blockchain within a given block range
   * Used for catching up on events that might have been missed
   */
  async resyncBlockRange(
    blockchain: Blockchain,
    fromBlock: number,
    toBlock: number,
    eventTypes: string[],
  ): Promise<void> {
    this.logger.log(
      `Resyncing events for ${blockchain.id} from block ${fromBlock} to ${toBlock}`,
    );

    const provider = this.providerManager.getProvider(blockchain);
    const contract = this.providerManager.getContract(blockchain);

    // Fetch events for the specified range
    const allEvents = await this.fetchEvents(
      contract,
      eventTypes,
      fromBlock,
      toBlock,
    );

    if (allEvents.length === 0) {
      this.logger.log(`No events found to resync in the given block range`);
      return;
    }

    // Prepare and store events
    const eventData = await this.eventStorageService.prepareEvents(
      blockchain,
      allEvents,
      provider,
    );
    const result = await this.eventStorageService.storeEvents(eventData);

    this.logger.log(
      `Resynced ${result.successCount} events (with ${result.errorCount} errors) for blockchain ${blockchain.id}`,
    );
  }
}
