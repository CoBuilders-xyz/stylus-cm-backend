import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { ethers } from 'ethers';
import { abi } from '../../constants/abis/cacheManager/cacheManager.json';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HistoricalEventSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(HistoricalEventSyncService.name);
  private contractListeners: Map<string, ethers.Contract> = new Map();
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  // Define event types to be monitored
  private eventTypes = [
    'InsertBid',
    'DeleteBid',
    'Pause',
    'Unpause',
    'SetCacheSize',
    'SetDecayRate',
    'Initialized',
  ];

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

    // Perform initial historical sync
    await this.syncHistoricalEvents();

    // Setup real-time event listeners
    await this.setupEventListeners();
  }

  async setupEventListeners() {
    this.logger.log('Setting up real-time event listeners...');

    // Get all blockchains from the repository
    const blockchains = await this.blockchainRepository.find();

    for (const blockchain of blockchains) {
      if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
        this.logger.warn(
          `Skipping blockchain ${blockchain.id} event listeners due to missing RPC URL or contract address.`,
        );
        continue;
      }

      try {
        // Create a provider for this blockchain
        const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
        this.providers.set(blockchain.id, provider);

        // Create a contract instance
        const contract = new ethers.Contract(
          blockchain.cacheManagerAddress,
          abi as ethers.InterfaceAbi,
          provider,
        );
        this.contractListeners.set(blockchain.id, contract);

        // Setup listeners for each event type
        for (const eventType of this.eventTypes) {
          this.setupEventListener(blockchain, contract, eventType, provider);
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
  }

  setupEventListener(
    blockchain: Blockchain,
    contract: ethers.Contract,
    eventType: string,
    provider: ethers.JsonRpcProvider,
  ): void {
    const eventHandler = (...args: any[]): void => {
      // Extract the event data from the arguments (last item)
      const eventObj: unknown = args[args.length - 1];

      try {
        // Determine the correct event log structure
        let eventLog: ethers.Log | ethers.EventLog;

        // Define type guard functions for runtime type checking
        function isEventWithLogProperty(
          obj: unknown,
        ): obj is { log: ethers.Log | ethers.EventLog } {
          if (obj === null || typeof obj !== 'object' || !('log' in obj))
            return false;

          const log = obj.log;
          if (
            log === null ||
            typeof log !== 'object' ||
            !('blockNumber' in log)
          )
            return false;

          const blockNumber = (log as { blockNumber: unknown }).blockNumber;
          return typeof blockNumber === 'number';
        }

        function isLogOrEventLog(
          obj: unknown,
        ): obj is ethers.Log | ethers.EventLog {
          if (
            obj === null ||
            typeof obj !== 'object' ||
            !('blockNumber' in obj)
          )
            return false;

          const blockNumber = (obj as { blockNumber: unknown }).blockNumber;
          return typeof blockNumber === 'number';
        }

        // Process based on type
        if (isEventWithLogProperty(eventObj)) {
          eventLog = eventObj.log;
        } else if (isLogOrEventLog(eventObj)) {
          eventLog = eventObj;
        } else {
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

    // Register the event listener
    contract.on(eventType, eventHandler);

    this.logger.log(
      `Subscribed to ${eventType} events for blockchain ${blockchain.id}`,
    );
  }

  // Separate method to handle the async event processing
  private async processEvent(
    blockchain: Blockchain,
    eventLog: ethers.Log | ethers.EventLog,
    provider: ethers.JsonRpcProvider,
    eventType: string,
  ): Promise<void> {
    try {
      await this.insertEvents(blockchain, [eventLog], provider);
      await this.updateLastSyncedBlock(blockchain, eventLog.blockNumber);
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

  // Method to manually trigger a resync (can be useful for API endpoints)
  async triggerResync(blockchainId?: string) {
    if (blockchainId) {
      const where: FindOptionsWhere<Blockchain> = { id: blockchainId };
      const blockchain = await this.blockchainRepository.findOne({
        where,
      });

      if (blockchain && blockchain.rpcUrl) {
        const provider =
          this.providers.get(blockchain.id) ||
          new ethers.JsonRpcProvider(blockchain.rpcUrl);

        await this.syncBlockchainEvents(blockchain, provider);
        return `Resynchronized events for blockchain ${blockchainId}`;
      } else {
        throw new Error(
          `Blockchain with ID ${blockchainId} not found or has no RPC URL`,
        );
      }
    } else {
      // Resync all blockchains
      await this.syncHistoricalEvents();
      return 'Resynchronized events for all blockchains';
    }
  }

  // Method to clean up listeners when the application shuts down
  async onModuleDestroy() {
    this.logger.log('Cleaning up event listeners...');

    // Remove all event listeners
    for (const [blockchainId, contract] of this.contractListeners.entries()) {
      try {
        void contract.removeAllListeners();
        this.logger.log(
          `Removed event listeners for blockchain ${blockchainId}`,
        );
      } catch (error) {
        this.logger.error(
          `Error removing listeners for blockchain ${blockchainId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Clear the maps
    this.contractListeners.clear();
    this.providers.clear();

    // Add an await statement to satisfy the linter
    await Promise.resolve();
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
        // Reuse the provider if it exists, or create a new one
        let provider = this.providers.get(blockchain.id);
        if (!provider) {
          provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
          this.providers.set(blockchain.id, provider);
        }

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

    // Loop through all event types and fetch their events
    let allEvents: (ethers.Log | ethers.EventLog)[] = [];

    for (
      let startingBlock = lastSyncedBlock;
      startingBlock < latestBlock;
      startingBlock += BATCH_SIZE
    ) {
      const endBlock = Math.min(startingBlock + BATCH_SIZE - 1, latestBlock);
      this.logger.log(
        `Querying events from ${startingBlock} to ${endBlock}...`,
      );

      for (const eventType of this.eventTypes) {
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
