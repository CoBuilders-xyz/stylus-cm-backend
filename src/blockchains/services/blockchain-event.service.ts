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
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BlockchainEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainEventService.name);
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

  // Config for the periodic resync
  private readonly RESYNC_BLOCKS_BACK: number = 100;

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
      await this.insertEvents(blockchain, [eventLog], provider, true);
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

    if (lastSyncedBlock >= latestBlock) {
      this.logger.log(`Blockchain ${blockchain.id} is already up to date.`);
      return;
    }

    this.logger.log(
      `Fetching events for blockchain ${blockchain.id} from block ${lastSyncedBlock} to ${latestBlock}...`,
    );

    // Loop through all event types and fetch their events
    let allEvents: (ethers.Log | ethers.EventLog)[] = [];

    const startingBlock = lastSyncedBlock;

    this.logger.log(
      `Querying events from ${startingBlock} to ${latestBlock}...`,
    );

    for (const eventType of this.eventTypes) {
      const eventFilter = cacheManagerContract.filters[eventType]();
      try {
        const events = await cacheManagerContract.queryFilter(
          eventFilter,
          startingBlock,
          latestBlock,
        );

        if (events.length > 0) {
          this.logger.log(
            `Found ${events.length} ${eventType} events from ${startingBlock} to ${latestBlock}`,
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
        `No new events found from ${startingBlock} to ${latestBlock}...`,
      );

      // Update the lastSyncedBlock even if no events were found
      await this.updateLastSyncedBlock(blockchain, latestBlock);
    }

    await this.insertEvents(blockchain, allEvents, provider);
    this.logger.log(
      `Saved ${allEvents.length} events from ${startingBlock} to ${latestBlock}...`,
    );

    // Update the lastSyncedBlock after successfully processing events
    await this.updateLastSyncedBlock(blockchain, latestBlock);

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
    isRealTime: boolean = false,
  ) {
    if (events.length === 0) return;

    // Function to safely extract transaction hash
    function getTransactionHash(event: ethers.Log | ethers.EventLog): string {
      // First try ethers v6 style properties
      if (
        'transactionHash' in event &&
        typeof event.transactionHash === 'string'
      ) {
        return event.transactionHash;
      }

      // Then try ethers v5 (with safe type handling)
      try {
        const eventAsAny = event as unknown;
        const record = eventAsAny as Record<string, unknown>;
        if (record && 'hash' in record && typeof record.hash === 'string') {
          return record.hash;
        }
      } catch {
        // Silently handle any errors in type conversion
      }

      return '';
    }

    // Function to safely extract log index
    function getLogIndex(event: ethers.Log | ethers.EventLog): number {
      // First try ethers v6 style
      if ('logIndex' in event && typeof event.logIndex === 'number') {
        return event.logIndex;
      }

      // Then try ethers v5 (with safe type handling)
      try {
        const eventAsAny = event as unknown;
        const record = eventAsAny as Record<string, unknown>;
        if (record && 'index' in record && typeof record.index === 'number') {
          return record.index;
        }
      } catch {
        // Silently handle any errors in type conversion
      }

      return 0;
    }

    // Create event records with unique identifiers
    const blockchainEvents = await Promise.all(
      events.map(async (event) => {
        const hasFragment = 'fragment' in event;
        const hasArgs = 'args' in event;
        const block = await provider.getBlock(event.blockNumber);

        // Get transaction hash and log index safely
        const transactionHash = getTransactionHash(event);
        const logIndex = getLogIndex(event);

        if (!transactionHash) {
          this.logger.warn(
            `Event without transaction hash found at block ${event.blockNumber}`,
          );
        }

        return {
          blockchain: blockchain,
          contractName: 'CacheManager',
          contractAddress: event.address,
          eventName: hasFragment ? event.fragment.name : '',
          blockTimestamp: new Date(block ? block.timestamp * 1000 : 0),
          blockNumber: event.blockNumber,
          transactionHash: transactionHash,
          logIndex: logIndex,
          isRealTime: isRealTime,
          isSynced: true,
          eventData: hasArgs
            ? (JSON.parse(
                JSON.stringify(
                  event.args,
                  (_, v): string | boolean | number | object | null =>
                    typeof v === 'bigint' ? v.toString() : v,
                ),
              ) as Record<string, any>)
            : {},
        };
      }),
    );

    // Split events into smaller batches to avoid large transactions
    const BATCH_SIZE = 50; // Smaller batch size for better error isolation
    const eventBatches: (typeof blockchainEvents)[] = [];

    for (let i = 0; i < blockchainEvents.length; i += BATCH_SIZE) {
      eventBatches.push(blockchainEvents.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each event individually to prevent transaction aborts from affecting other events
    for (const batch of eventBatches) {
      for (const eventData of batch) {
        // Each event gets its own transaction
        const queryRunner =
          this.eventSyncRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Try to insert the event
          await queryRunner.manager.insert(BlockchainEvent, eventData);

          await queryRunner.commitTransaction();
          this.logger.debug(
            `Inserted event ${eventData.eventName} with tx hash ${eventData.transactionHash} and log index ${eventData.logIndex}`,
          );
          successCount++;
        } catch (insertError: unknown) {
          // Handle duplicate key error more safely
          if (insertError instanceof Error) {
            const pgError = insertError as { code?: string };

            // Check for duplicate key violation
            if (pgError.code === '23505') {
              await queryRunner.rollbackTransaction();

              // Start a new transaction for the update operation
              await queryRunner.startTransaction();

              try {
                // If this is a real-time event, update the flag in the existing record
                if (isRealTime) {
                  await queryRunner.manager
                    .createQueryBuilder()
                    .update(BlockchainEvent)
                    .set({ isRealTime: true })
                    .where({
                      transactionHash: eventData.transactionHash,
                      logIndex: eventData.logIndex,
                      blockchain: { id: blockchain.id },
                      eventName: eventData.eventName,
                    })
                    .execute();

                  await queryRunner.commitTransaction();
                  this.logger.debug(
                    `Updated real-time flag for event ${eventData.eventName} with tx hash ${eventData.transactionHash}`,
                  );
                  successCount++;
                } else {
                  await queryRunner.commitTransaction();
                  this.logger.debug(
                    `Skipped duplicate event ${eventData.eventName} with tx hash ${eventData.transactionHash}`,
                  );
                  successCount++; // Count as success since skipping a duplicate is expected
                }
              } catch (updateError) {
                // If update fails, roll back and count as error
                await queryRunner.rollbackTransaction();
                this.logger.error(
                  `Failed to update real-time flag for event ${eventData.eventName} with tx hash ${eventData.transactionHash}: ${
                    updateError instanceof Error
                      ? updateError.message
                      : String(updateError)
                  }`,
                );
                errorCount++;
              }
            } else {
              // For other database errors, log and count as error
              await queryRunner.rollbackTransaction();
              this.logger.error(
                `Error inserting event ${eventData.eventName} with tx hash ${eventData.transactionHash}: ${
                  insertError.message
                }`,
              );
              errorCount++;
            }
          } else {
            // For non-Error exceptions
            await queryRunner.rollbackTransaction();
            this.logger.error(
              `Unknown error inserting event: ${String(insertError)}`,
            );
            errorCount++;
          }
        } finally {
          // Always release the query runner
          await queryRunner.release();
        }
      }
    }

    // Log overall results
    this.logger.log(
      `Finished processing ${blockchainEvents.length} events for blockchain ${blockchain.id}: ${successCount} successful, ${errorCount} errors`,
    );
  }

  // Run every hour to catch events that might have been missed
  @Cron('0 * * * *')
  async periodicEventResync() {
    this.logger.log('Starting periodic event resync to catch missed events');

    const blockchains = await this.blockchainRepository.find();
    for (const blockchain of blockchains) {
      try {
        if (!blockchain.rpcUrl || !blockchain.cacheManagerAddress) {
          this.logger.warn(
            `Skipping blockchain ${blockchain.id} due to missing RPC URL or contract address.`,
          );
          continue;
        }

        // Get provider
        let provider = this.providers.get(blockchain.id);
        if (!provider) {
          provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
          this.providers.set(blockchain.id, provider);
        }

        // Get current latest block
        const latestBlock = await provider.getBlockNumber();

        // Calculate starting block for resync - look back RESYNC_BLOCKS_BACK blocks
        const lastSyncedBlock = await this.getLastSyncedBlock(blockchain);
        const resyncStartBlock = Math.max(
          0,
          lastSyncedBlock - this.RESYNC_BLOCKS_BACK,
        );

        // Only proceed if we have blocks to resync
        if (resyncStartBlock >= latestBlock) {
          this.logger.log(`No blocks to resync for ${blockchain.id}`);
          continue;
        }

        // Perform targeted resync
        await this.resyncBlockRange(
          blockchain,
          provider,
          resyncStartBlock,
          latestBlock,
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
  }

  // Resync a specific range of blocks to catch missed events
  private async resyncBlockRange(
    blockchain: Blockchain,
    provider: ethers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number,
  ) {
    this.logger.log(
      `Resyncing events for ${blockchain.id} from block ${fromBlock} to ${toBlock}`,
    );

    const cacheManagerContract = new ethers.Contract(
      blockchain.cacheManagerAddress,
      abi as ethers.InterfaceAbi,
      provider,
    );

    let allEvents: (ethers.Log | ethers.EventLog)[] = [];

    // Query for each event type in the range
    for (const eventType of this.eventTypes) {
      try {
        const eventFilter = cacheManagerContract.filters[eventType]();
        const events = await cacheManagerContract.queryFilter(
          eventFilter,
          fromBlock,
          toBlock,
        );

        if (events.length > 0) {
          this.logger.log(
            `Found ${events.length} ${eventType} events to resync from block ${fromBlock} to ${toBlock}`,
          );
          allEvents = [...allEvents, ...events];
        }
      } catch (error) {
        this.logger.error(
          `Error fetching ${eventType} events during resync: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (allEvents.length === 0) {
      this.logger.log(`No events found to resync in the given block range`);
      return;
    }

    // Process the events - they'll be deduplicated in insertEvents
    await this.insertEvents(blockchain, allEvents, provider);

    // Don't update lastSyncedBlock as this is a backup sync
    // and the main sync process should manage that
  }
}
