import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Blockchain } from '../entities/blockchain.entity';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { Interval } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { abi } from '../../constants/abis/cacheManager/cacheManager.json';

interface ContractState {
  isCached: boolean;
  bid: number;
  size: number;
  address?: string;
  name?: string;
  lastEventBlock?: number;
  lastEventName?: string;
}

// interface EventHistoryItem {
//   eventName: string;
//   blockNumber: number;
//   logIndex: number;
//   timestamp: string;
// }

@Injectable()
export class BlockchainEventProcessorService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainEventProcessorService.name);
  private isInitialProcessingComplete = false;

  // Track problematic contracts for analysis
  private problematicContracts = new Set<string>();

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing blockchain event processor...');
    // Intentionally using setTimeout without await
    // On startup, wait for a few seconds to ensure the database is synced before processing
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.processAllEvents()
          .catch((err: Error) =>
            this.logger.error(
              `Failed during initial event processing: ${err.message}`,
            ),
          )
          .finally(() => resolve());
      }, 10000); // Wait 10 seconds before starting initial processing
    });
  }

  @Interval(60000) // Run every minute
  async scheduledEventProcessing(): Promise<void> {
    // Only run scheduled processing after initial processing is complete
    if (this.isInitialProcessingComplete) {
      try {
        // Process any new events that were created since last check
        await this.processNewEvents();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error in scheduled event processing: ${errorMessage}`,
        );
      }
    }
  }

  async processAllEvents(): Promise<void> {
    this.logger.log('Starting full event processing...');

    try {
      // Get all blockchains
      const blockchains = await this.blockchainRepository.find();

      for (const blockchain of blockchains) {
        this.logger.log(`Processing events for blockchain: ${blockchain.name}`);

        // Check if we've processed events for this blockchain before
        const whereCondition: FindOptionsWhere<BlockchainEvent> = {
          blockchain: { id: blockchain.id },
          eventName: In(['InsertBid', 'DeleteBid']),
        };

        // Find events to process - only those newer than the last processed event if available
        let events: BlockchainEvent[] = [];
        if (blockchain.lastProcessedEventId) {
          this.logger.log(
            `Resuming processing from last processed event (Block: ${blockchain.lastProcessedBlockNumber}, LogIndex: ${blockchain.lastProcessedLogIndex})`,
          );

          // We need a complex query to find events that are either:
          // 1. In a higher block number than the last processed event
          // 2. In the same block but with a higher log index
          const rawQueryResults = (await this.blockchainEventRepository.query(
            `SELECT * FROM blockchain_event
            WHERE "blockchainId" = $1
            AND "eventName" IN ('InsertBid', 'DeleteBid')
            AND (
              ("blockNumber" > $2) OR 
              ("blockNumber" = $2 AND "logIndex" > $3)
            )
            ORDER BY "blockNumber" ASC, "logIndex" ASC`,
            [
              blockchain.id,
              blockchain.lastProcessedBlockNumber,
              blockchain.lastProcessedLogIndex,
            ],
          )) as BlockchainEvent[];

          events = rawQueryResults;
        } else {
          events = await this.blockchainEventRepository.find({
            where: whereCondition,
            order: { blockNumber: 'ASC', logIndex: 'ASC' },
          });
        }

        this.logger.log(
          `Found ${events.length} events to process for blockchain ${blockchain.name} (initial run)`,
        );

        // Log a sample event to debug the structure
        if (events.length > 0) {
          this.logger.debug(
            `Sample event data: ${JSON.stringify(events[0].eventData, null, 2)}`,
          );

          // Process the events
          await this.processBlockchainEvents(blockchain, events);

          // Update the last processed event information
          await this.updateLastProcessedEvent(
            blockchain,
            events[events.length - 1],
          );
        }

        // After processing events, verify the cache status against on-chain data
        if (blockchain.rpcUrl && blockchain.cacheManagerAddress) {
          await this.verifyContractCacheStatus(blockchain);

          // // After verification, analyze problematic contracts
          // if (this.problematicContracts.size > 0) {
          //   await this.analyzeProblematicContracts(blockchain);
          // }
        }
      }

      this.isInitialProcessingComplete = true;
      this.logger.log('Initial event processing completed successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process events: ${errorMessage}`);
    }
  }

  async processNewEvents(): Promise<void> {
    this.logger.debug('Processing new blockchain events...');

    // Get all blockchains
    const blockchains = await this.blockchainRepository.find();

    for (const blockchain of blockchains) {
      // Check if we have processed events for this blockchain before
      if (!blockchain.lastProcessedEventId) {
        // If not, run the full processing
        this.logger.log(
          `No last processed event for ${blockchain.name}, running full processing`,
        );
        await this.processAllEvents();
        continue;
      }

      // Find events that are newer than the last processed one
      const newEvents = (await this.blockchainEventRepository.query(
        `SELECT * FROM blockchain_event
        WHERE "blockchainId" = $1
        AND "eventName" IN ('InsertBid', 'DeleteBid')
        AND (
          ("blockNumber" > $2) OR 
          ("blockNumber" = $2 AND "logIndex" > $3)
        )
        ORDER BY "blockNumber" ASC, "logIndex" ASC`,
        [
          blockchain.id,
          blockchain.lastProcessedBlockNumber,
          blockchain.lastProcessedLogIndex,
        ],
      )) as BlockchainEvent[];

      if (newEvents.length > 0) {
        this.logger.log(
          `Processing ${newEvents.length} new events for blockchain ${blockchain.name} since block ${blockchain.lastProcessedBlockNumber}, logIndex ${blockchain.lastProcessedLogIndex}`,
        );

        await this.processBlockchainEvents(blockchain, newEvents);

        // Update the last processed event information
        await this.updateLastProcessedEvent(
          blockchain,
          newEvents[newEvents.length - 1],
        );

        // Verify cache status after processing new events
        if (blockchain.rpcUrl && blockchain.cacheManagerAddress) {
          await this.verifyContractCacheStatus(blockchain);
        }
      } else {
        this.logger.debug(
          `No new events to process for blockchain ${blockchain.name}`,
        );
      }
    }
  }

  /**
   * Updates the blockchain entity with information about the last processed event
   */
  private async updateLastProcessedEvent(
    blockchain: Blockchain,
    lastEvent: BlockchainEvent,
  ): Promise<void> {
    try {
      // Update the blockchain with the latest processed event info
      await this.blockchainRepository.update(blockchain.id, {
        lastProcessedEventId: lastEvent.id,
        lastProcessedBlockNumber: lastEvent.blockNumber,
        lastProcessedLogIndex: lastEvent.logIndex,
        lastProcessedTimestamp: lastEvent.blockTimestamp,
      });

      this.logger.debug(
        `Updated last processed event for ${blockchain.name} to block ${lastEvent.blockNumber}, logIndex ${lastEvent.logIndex}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update last processed event for blockchain ${blockchain.name}: ${errorMessage}`,
      );
    }
  }

  private async processBlockchainEvents(
    blockchain: Blockchain,
    events: BlockchainEvent[],
  ): Promise<void> {
    // Track contract states by codeHash
    const contractStates = new Map<string, ContractState>();

    // Process events in chronological order (events are already sorted by blockNumber and logIndex)
    for (const event of events) {
      // Debug log the raw event data for the first few events
      if (contractStates.size < 3) {
        this.logger.debug(
          `Raw eventData for ${event.eventName}: ${JSON.stringify(event.eventData, null, 2)}`,
        );
      }

      try {
        if (event.eventName === 'InsertBid') {
          // Process InsertBid event
          this.processInsertBidEvent(event, contractStates);
        } else if (event.eventName === 'DeleteBid') {
          // Process DeleteBid event
          this.processDeleteBidEvent(event, contractStates);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error processing event ${event.eventName}: ${errorMessage}`,
        );
        this.logger.error(`Event data: ${JSON.stringify(event.eventData)}`);
      }
    }

    // Now update or create contracts in the database
    for (const [codeHash, state] of contractStates.entries()) {
      // Skip entries without a valid address
      if (!state.address) {
        this.logger.debug(`Skipping contract ${codeHash} with no address`);
        continue;
      }

      try {
        // Try to find existing contract
        const contract = await this.contractRepository.findOne({
          where: {
            blockchain: { id: blockchain.id },
            bytecodeHash: codeHash,
          } as FindOptionsWhere<Contract>,
        });

        if (contract) {
          // Update existing contract
          contract.lastBid = state.bid;
          contract.size = state.size;
          // Set isCached based on the last event type for this contract
          contract.isCached = state.isCached;
          await this.contractRepository.save(contract);
          this.logger.debug(
            `Updated contract ${codeHash} in the database, cached status: ${state.isCached}` +
              ` (last event: ${state.lastEventName} at block ${state.lastEventBlock})`,
          );
        } else {
          // Create new contract
          const newContract = this.contractRepository.create({
            blockchain,
            address: state.address,
            bytecodeHash: codeHash,
            name: `Contract-${codeHash.substring(0, 8)}`,
            size: state.size,
            lastBid: state.bid,
            isCached: state.isCached, // Set the initial cached status
          });

          await this.contractRepository.save(newContract);
          this.logger.debug(
            `Created new contract ${codeHash} in the database, cached status: ${state.isCached}` +
              ` (last event: ${state.lastEventName} at block ${state.lastEventBlock})`,
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error updating/creating contract ${codeHash}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Processed ${events.length} events and updated ${contractStates.size} contracts for blockchain ${blockchain.name}`,
    );
  }

  /**
   * Verifies the cache status of all contracts against the on-chain data
   * This is a safety net to ensure our database is accurate
   */
  private async verifyContractCacheStatus(
    blockchain: Blockchain,
  ): Promise<void> {
    try {
      this.logger.log(
        `Verifying contract cache status for blockchain ${blockchain.name} against on-chain data`,
      );

      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
      const contract = new ethers.Contract(
        blockchain.cacheManagerAddress,
        abi as ethers.InterfaceAbi,
        provider,
      );

      // Get the current entries (cached contracts) from the blockchain
      const onChainEntries = (await contract.getEntries()) as Array<{
        code: string;
        size: ethers.BigNumberish;
        bid: ethers.BigNumberish;
      }>;

      // Extract code hashes (bytecode hashes) of all cached contracts on-chain
      const cachedCodeHashes = new Set<string>();
      for (const entry of onChainEntries) {
        cachedCodeHashes.add(entry.code);
      }

      this.logger.log(
        `Found ${cachedCodeHashes.size} contracts currently cached on-chain`,
      );

      // Get all contracts for this blockchain from our database
      const allContracts = await this.contractRepository.find({
        where: { blockchain: { id: blockchain.id } },
      });

      let correctedCount = 0;

      // Clear the problematic contracts set before each verification
      this.problematicContracts.clear();

      // Check each contract against the on-chain data
      for (const contract of allContracts) {
        const isActuallyCached = cachedCodeHashes.has(contract.bytecodeHash);

        // If our database doesn't match the on-chain status, fix it
        if (contract.isCached !== isActuallyCached) {
          this.logger.warn(
            `Contract ${contract.bytecodeHash} (${contract.address}) has incorrect cache status: ` +
              `DB: ${contract.isCached}, On-chain: ${isActuallyCached}. Correcting...`,
          );

          // Track problematic contracts for later analysis
          this.problematicContracts.add(contract.bytecodeHash);

          contract.isCached = isActuallyCached;
          await this.contractRepository.save(contract);
          correctedCount++;
        }
      }

      if (correctedCount > 0) {
        this.logger.log(
          `Corrected cache status for ${correctedCount} contracts`,
        );
      } else {
        this.logger.log('All contracts have correct cache status');
      }

      // Log the current state after verification
      const cachedContractsInDb = await this.contractRepository.count({
        where: {
          blockchain: { id: blockchain.id },
          isCached: true,
        },
      });

      this.logger.log(
        `After verification: ${cachedContractsInDb} contracts marked as cached in DB, ${cachedCodeHashes.size} contracts actually cached on-chain`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error verifying contract cache status: ${errorMessage}`,
      );
    }
  }

  //   /**
  //    * Analyzes problematic contracts to understand why they have an incorrect cache status
  //    */
  //   private async analyzeProblematicContracts(
  //     blockchain: Blockchain,
  //   ): Promise<void> {
  //     try {
  //       this.logger.log(
  //         `Analyzing ${this.problematicContracts.size} problematic contracts...`,
  //       );

  //       for (const bytecodeHash of this.problematicContracts) {
  //         // Get contract details
  //         const contract = await this.contractRepository.findOne({
  //           where: {
  //             blockchain: { id: blockchain.id },
  //             bytecodeHash,
  //           } as FindOptionsWhere<Contract>,
  //         });

  //         if (!contract) {
  //           this.logger.warn(
  //             `Cannot find contract with bytecodeHash ${bytecodeHash}`,
  //           );
  //           continue;
  //         }

  //         // Get all InsertBid and DeleteBid events for this contract
  //         const events = await this.blockchainEventRepository.find({
  //           where: {
  //             blockchain: { id: blockchain.id },
  //             eventName: In(['InsertBid', 'DeleteBid']),
  //           },
  //           order: { blockNumber: 'ASC', logIndex: 'ASC' },
  //         });

  //         // Filter and map events for this specific contract
  //         const contractEvents: EventHistoryItem[] = [];

  //         for (const event of events) {
  //           const eventData = event.eventData as unknown[];

  //           if (!Array.isArray(eventData) || eventData.length === 0) {
  //             continue;
  //           }

  //           const eventCodeHash = String(eventData[0]);

  //           if (eventCodeHash === bytecodeHash) {
  //             contractEvents.push({
  //               eventName: event.eventName,
  //               blockNumber: event.blockNumber,
  //               logIndex: event.logIndex,
  //               timestamp: event.blockTimestamp?.toISOString() || 'unknown',
  //             });
  //           }
  //         }

  //         if (contractEvents.length === 0) {
  //           this.logger.warn(
  //             `No events found for contract ${bytecodeHash} (${contract.address})`,
  //           );
  //           continue;
  //         }

  //         // Log the event history
  //         const lastEvent = contractEvents[contractEvents.length - 1];
  //         const expectedCachedStatus = lastEvent.eventName === 'InsertBid';

  //         this.logger.log(`
  // === Event History Analysis for Contract ${bytecodeHash} (${contract.address}) ===
  // Total events: ${contractEvents.length}
  // Last event: ${lastEvent.eventName} at block ${lastEvent.blockNumber} (logIndex: ${lastEvent.logIndex})
  // Expected cache status based on last event: ${expectedCachedStatus}
  // Actual status in DB before correction: ${contract.isCached}
  // Event sequence:
  // ${contractEvents.map((e, i) => `${i + 1}. ${e.eventName} at block ${e.blockNumber} (logIndex: ${e.logIndex}, time: ${e.timestamp})`).join('\n')}
  //         `);

  //         // Identify issues
  //         if (expectedCachedStatus !== contract.isCached) {
  //           // Find potential duplicate or out-of-order events
  //           const seenBlocks = new Set<number>();
  //           const duplicateBlocks = new Set<number>();

  //           for (const event of contractEvents) {
  //             if (seenBlocks.has(event.blockNumber)) {
  //               duplicateBlocks.add(event.blockNumber);
  //             } else {
  //               seenBlocks.add(event.blockNumber);
  //             }
  //           }

  //           if (duplicateBlocks.size > 0) {
  //             this.logger.warn(
  //               `Found events in duplicate blocks: ${Array.from(duplicateBlocks).join(', ')}`,
  //             );

  //             // Check if events in the same block have different names (potentially a race condition)
  //             for (const blockNumber of duplicateBlocks) {
  //               const eventsInBlock = contractEvents.filter(
  //                 (e) => e.blockNumber === blockNumber,
  //               );
  //               const eventNames = new Set(eventsInBlock.map((e) => e.eventName));

  //               if (eventNames.size > 1) {
  //                 this.logger.warn(
  //                   `Block ${blockNumber} has both InsertBid and DeleteBid events - potential race condition!`,
  //                 );

  //                 // Log events in this block in order of logIndex
  //                 const sortedEvents = eventsInBlock.sort(
  //                   (a, b) => a.logIndex - b.logIndex,
  //                 );
  //                 this.logger.warn(
  //                   `Events in block ${blockNumber} by logIndex: ${sortedEvents.map((e) => `${e.eventName}(${e.logIndex})`).join(', ')}`,
  //                 );
  //               }
  //             }
  //           }

  //           // Check for gaps in history that might indicate missed events
  //           const blockNumbers = contractEvents
  //             .map((e) => e.blockNumber)
  //             .sort((a, b) => a - b);
  //           for (let i = 1; i < blockNumbers.length; i++) {
  //             const gap = blockNumbers[i] - blockNumbers[i - 1];
  //             if (gap > 1) {
  //               this.logger.warn(
  //                 `Gap of ${gap} blocks between events at blocks ${blockNumbers[i - 1]} and ${blockNumbers[i]}`,
  //               );
  //             }
  //           }
  //         }
  //       }
  //     } catch (error: unknown) {
  //       const errorMessage =
  //         error instanceof Error ? error.message : String(error);
  //       this.logger.error(
  //         `Error analyzing problematic contracts: ${errorMessage}`,
  //       );
  //     }
  //   }

  private processInsertBidEvent(
    event: BlockchainEvent,
    contractStates: Map<string, ContractState>,
  ): void {
    // Based on the logs, we know that eventData is an array:
    // [codeHash, address, bid, size]
    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 4) {
      this.logger.warn(
        `InsertBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const codeHash = String(eventDataArray[0]);
    const address = String(eventDataArray[1]);
    const bidValue = String(eventDataArray[2]);
    const size = Number(eventDataArray[3]);

    if (!codeHash) {
      this.logger.warn(`Missing codehash in InsertBid event`);
      return;
    }

    const bid = bidValue ? parseFloat(ethers.formatEther(bidValue)) : 0;
    const existingState = contractStates.get(codeHash);

    // More precise event ordering logic
    const shouldUpdate = this.isMoreRecentEvent(
      event,
      existingState?.lastEventBlock,
      existingState?.lastEventName,
    );

    if (shouldUpdate) {
      // Create or update contract state, marking as cached since this is an InsertBid event
      contractStates.set(codeHash, {
        isCached: true, // InsertBid means the contract is cached
        bid,
        size,
        address,
        lastEventBlock: event.blockNumber,
        lastEventName: 'InsertBid',
      });

      this.logger.debug(
        `InsertBid: Contract ${codeHash} inserted with bid ${bid} at address ${address} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : ''),
      );
    } else {
      this.logger.debug(
        `Skipping older InsertBid event for ${codeHash} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          ` (already have event from block ${existingState?.lastEventBlock})`,
      );
    }
  }

  private processDeleteBidEvent(
    event: BlockchainEvent,
    contractStates: Map<string, ContractState>,
  ): void {
    // Based on the logs, DeleteBid event data is an array:
    // [codeHash, bid, size]
    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 3) {
      this.logger.warn(
        `DeleteBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const codeHash = String(eventDataArray[0]);
    const bidValue = String(eventDataArray[1]);
    const size = Number(eventDataArray[2]);

    if (!codeHash) {
      this.logger.warn(`Missing codehash in DeleteBid event`);
      return;
    }

    const bid = bidValue ? parseFloat(ethers.formatEther(bidValue)) : 0;
    const existingState = contractStates.get(codeHash);

    // More precise event ordering logic
    const shouldUpdate = this.isMoreRecentEvent(
      event,
      existingState?.lastEventBlock,
      existingState?.lastEventName,
    );

    if (shouldUpdate) {
      // Update contract state, marking as not cached since this is a DeleteBid event
      contractStates.set(codeHash, {
        isCached: false, // DeleteBid means the contract is no longer cached
        bid: existingState?.bid || bid,
        size: existingState?.size || size,
        address: existingState?.address,
        lastEventBlock: event.blockNumber,
        lastEventName: 'DeleteBid',
      });

      this.logger.debug(
        `DeleteBid: Contract ${codeHash} removed from cache at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : ''),
      );
    } else {
      this.logger.debug(
        `Skipping older DeleteBid event for ${codeHash} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          ` (already have event from block ${existingState?.lastEventBlock})`,
      );
    }
  }

  /**
   * Determines if an event is more recent than existing state
   * with special handling for events in the same block
   */
  private isMoreRecentEvent(
    event: BlockchainEvent,
    lastEventBlock?: number,
    lastEventName?: string,
  ): boolean {
    // If we don't have previous state, always update
    if (lastEventBlock === undefined || lastEventName === undefined) {
      return true;
    }

    // If event is in a later block, it's more recent
    if (event.blockNumber > lastEventBlock) {
      return true;
    }

    // If event is in an earlier block, it's older
    if (event.blockNumber < lastEventBlock) {
      return false;
    }

    // For events in the same block, use logIndex if available
    if (
      event.blockNumber === lastEventBlock &&
      'logIndex' in event &&
      typeof event.logIndex === 'number'
    ) {
      // Use logIndex to determine the order
      // Default to logIndex 0 for previous events (conservative approach)
      return event.logIndex > 0;
    }

    // If we can't determine order precisely, make a safe choice
    // If the new event is DeleteBid, use it (safest to mark as uncached)
    if (event.eventName === 'DeleteBid') {
      this.logger.warn(
        `Ambiguous event ordering for block ${event.blockNumber}, choosing DeleteBid for safety`,
      );
      return true;
    }

    // For InsertBid, keep the previous state
    return false;
  }
}
