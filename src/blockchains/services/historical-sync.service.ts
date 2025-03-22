import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { ethers } from 'ethers';
import { abi } from '../../constants/abis/cacheManager/cacheManager.json';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HistoricalEventSyncService {
  private readonly logger = new Logger(HistoricalEventSyncService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainEvent)
    private readonly eventSyncRepository: Repository<BlockchainEvent>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting initial historical event sync on load...');
    const config = this.configService.get('blockchains') as Blockchain[];
    for (const blockchain of config) {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId, rpcUrl: blockchain.rpcUrl },
      });
      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
      }
    }

    await this.syncHistoricalEvents();
  }

  async syncHistoricalEvents() {
    this.logger.debug('Starting historical event synchronization...');

    const blockchains = await this.blockchainRepository.find();
    for (const blockchain of blockchains) {
      if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
        this.logger.warn(
          `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
        );
        continue;
      }

      try {
        const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
        await this.syncBlockchainEvents(blockchain, provider);
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
  }

  async syncBlockchainEvents(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
  ) {
    const cacheManagerContract = new ethers.Contract(
      blockchain.cacheManagerAddress,
      abi as ethers.InterfaceAbi,
      provider,
    );

    // Get last processed block for this blockchain
    const lastSyncedBlock = await this.getLastSyncedBlock(blockchain);
    const latestBlock = await provider.getBlockNumber();
    const BATCH_SIZE = parseInt(process.env.EVENTS_FILTER_BATCH_SIZE || '5000'); // Adjust based on network performance

    if (lastSyncedBlock >= latestBlock) {
      this.logger.log(`Blockchain ${blockchain.id} is already up to date.`);
      return;
    }

    this.logger.log(
      `Fetching events for blockchain ${blockchain.id} from block ${lastSyncedBlock} to ${latestBlock}...`,
    );

    // Define all event types to be pulled
    const eventTypes = [
      'InsertBid',
      'DeleteBid',
      'Pause',
      'Unpause',
      'SetCacheSize',
      'SetDecayRate',
      'Initialized',
    ];

    for (
      let startingBlock = lastSyncedBlock;
      startingBlock < latestBlock;
      startingBlock += BATCH_SIZE
    ) {
      const endBlock = Math.min(startingBlock + BATCH_SIZE - 1, latestBlock);
      this.logger.log(
        `Querying events from ${startingBlock} to ${endBlock}...`,
      );

      // Loop through all event types and fetch their events
      let allEvents: (ethers.Log | ethers.EventLog)[] = [];

      for (const eventType of eventTypes) {
        const eventFilter = cacheManagerContract.filters[eventType]();
        try {
          const events = await cacheManagerContract.queryFilter(
            eventFilter,
            startingBlock,
            endBlock,
          );

          if (events.length > 0) {
            this.logger.log(
              `Found ${events.length} ${eventType} events from ${startingBlock} to ${endBlock}`,
            );
            allEvents = [...allEvents, ...events];
          }
        } catch (error) {
          this.logger.error(
            `Error fetching ${eventType} events: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (allEvents.length === 0) {
        this.logger.log(
          `No new events found from ${startingBlock} to ${endBlock}...`,
        );

        // Update the lastSyncedBlock even if no events were found
        await this.updateLastSyncedBlock(blockchain, endBlock);
        continue;
      }

      await this.insertEvents(blockchain, allEvents, provider);
      this.logger.log(
        `Saved ${allEvents.length} events from ${startingBlock} to ${endBlock}...`,
      );

      // Update the lastSyncedBlock after successfully processing events
      await this.updateLastSyncedBlock(blockchain, endBlock);
    }

    this.logger.log(
      `Finished historical event synchronization for blockchain ${blockchain.id}.`,
    );
  }

  async getLastSyncedBlock(blockchain: Blockchain): Promise<number> {
    const lastSync = await this.blockchainRepository.findOne({
      where: { id: blockchain.id },
    });

    return lastSync?.lastSyncedBlock || 0;
  }

  async updateLastSyncedBlock(
    blockchain: Blockchain,
    blockNumber: number,
  ): Promise<void> {
    await this.blockchainRepository.update(
      { id: blockchain.id },
      { lastSyncedBlock: blockNumber },
    );

    this.logger.debug(
      `Updated last synced block for blockchain ${blockchain.id} to ${blockNumber}`,
    );
  }

  async insertEvents(
    blockchain: Blockchain,
    events: (ethers.Log | ethers.EventLog)[],
    provider: ethers.JsonRpcProvider,
  ) {
    if (events.length === 0) return;

    const blockchainEvents = await Promise.all(
      events.map(async (event) => {
        const hasFragment = 'fragment' in event;
        const hasArgs = 'args' in event;
        const block = await provider.getBlock(event.blockNumber);
        return {
          blockchain: blockchain, // Make sure blockchain is set properly
          contractName: 'CacheManager', // Example contract name
          contractAddress: event.address,
          eventName: hasFragment ? event.fragment.name : '',
          blockTimestamp: new Date(block ? block.timestamp * 1000 : 0), // Convert to Date
          blockNumber: event.blockNumber,
          isSynced: true,
          eventData: hasArgs
            ? (JSON.parse(
                JSON.stringify(
                  event.args,
                  (_, v): string | boolean | number | object | null =>
                    typeof v === 'bigint' ? v.toString() : v,
                ),
              ) as Record<string, any>)
            : {}, // Store all event arguments as JSON
        };
      }),
    );
    await this.eventSyncRepository.insert(blockchainEvents);
  }
}
