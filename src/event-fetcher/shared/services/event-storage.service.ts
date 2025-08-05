import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../../blockchains/entities/blockchain-event.entity';
import { EventConfigService } from './event-config.service';
import {
  BlockchainEventData,
  EthersEvent,
  EventProcessResult,
} from '../interfaces';
import {
  getTransactionHash,
  getLogIndex,
  hasFragment,
  hasArgs,
  serializeEventArgs,
} from '../../utils/event-parser.util';
import { createModuleLogger } from '../../../common/utils/logger.util';
import { MODULE_NAME } from '../../constants/module.constants';

/**
 * Handles the storage and retrieval of blockchain events
 */
@Injectable()
export class EventStorageService {
  private readonly logger = createModuleLogger(
    EventStorageService,
    MODULE_NAME,
  );
  private readonly DEFAULT_BATCH_SIZE = 50;

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly eventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly eventConfigService: EventConfigService,
  ) {}

  /**
   * Gets the last synced block for a blockchain
   */
  async getLastSyncedBlock(blockchain: Blockchain): Promise<number> {
    const lastSync = await this.blockchainRepository.findOne({
      where: { id: blockchain.id },
    });

    return lastSync?.lastSyncedBlock || 0;
  }

  /**
   * Updates the last synced block for a blockchain
   */
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

  /**
   * Prepares blockchain event data from ethers events
   */
  async prepareEvents(
    blockchain: Blockchain,
    events: EthersEvent[],
    provider: ethers.JsonRpcProvider | ethers.FallbackProvider,
    isRealTime: boolean = false,
    eventType?: string,
    eventData?: Record<string, any>,
  ): Promise<BlockchainEventData[]> {
    if (events.length === 0) return [];

    // Create event records with unique identifiers
    return Promise.all(
      events.map(async (event) => {
        const block = await provider.getBlock(event.blockNumber);
        const transactionHash = getTransactionHash(event);
        const logIndex = getLogIndex(event);

        // Get transaction data to extract the sender address
        const tx = await provider.getTransaction(transactionHash);
        const originAddress = tx?.from || undefined;

        this.logger.debug(
          `Transaction ${transactionHash} sender address: ${originAddress}`,
        );

        // Infer contract name from the contract address
        let contractName = 'Unknown';
        if (
          event.address.toLowerCase() ===
          blockchain.cacheManagerAddress?.toLowerCase()
        ) {
          contractName = 'CacheManager';
        } else if (
          event.address.toLowerCase() ===
          blockchain.cacheManagerAutomationAddress?.toLowerCase()
        ) {
          contractName = 'CacheManagerAutomation';
        } else {
          this.logger.warn(
            `Unknown contract address ${event.address} does not match any known contract for blockchain ${blockchain.id}`,
          );
        }

        // Use provided eventType if available, otherwise try to extract from fragment
        let finalEventName = '';
        if (eventType) {
          // Use the explicitly provided eventType (from queue)
          finalEventName = eventType;
          this.logger.debug(
            `Using provided eventType: ${eventType} for event at block ${event.blockNumber}`,
          );
        } else {
          // Fallback to fragment extraction (for historical sync)
          finalEventName = hasFragment(event) ? event.fragment.name : '';
          if (!finalEventName) {
            this.logger.warn(
              `Could not determine event name for event at block ${event.blockNumber}, address ${event.address}`,
            );
          }
        }

        // Use provided eventData if available, otherwise try to extract from args
        let finalEventData: Record<string, any> = {};
        if (eventData) {
          // Use the explicitly provided eventData (from queue)
          finalEventData = eventData;
        } else {
          // Fallback to args extraction (for historical sync)
          finalEventData = hasArgs(event) ? serializeEventArgs(event.args) : {};
        }

        return {
          blockchain: blockchain,
          contractName: contractName,
          contractAddress: event.address,
          eventName: finalEventName,
          blockTimestamp: new Date(block ? block.timestamp * 1000 : 0),
          blockNumber: event.blockNumber,
          transactionHash: transactionHash,
          logIndex: logIndex,
          isRealTime: isRealTime,
          originAddress: originAddress,
          eventData: finalEventData,
        };
      }),
    );
  }

  /**
   * Inserts or updates blockchain events in the database
   */
  async storeEvents(
    events: BlockchainEventData[],
  ): Promise<EventProcessResult> {
    if (events.length === 0) {
      return { successCount: 0, errorCount: 0, totalEvents: 0 };
    }

    // Split events into smaller batches
    const eventBatches: BlockchainEventData[][] = [];
    const batchSize = this.eventConfigService.getBatchSize();
    for (let i = 0; i < events.length; i += batchSize) {
      eventBatches.push(events.slice(i, i + batchSize));
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each event individually to prevent transaction aborts
    for (const batch of eventBatches) {
      for (const eventData of batch) {
        // Each event gets its own transaction
        const queryRunner =
          this.eventRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Try to insert the event
          await queryRunner.manager.insert(BlockchainEvent, eventData);

          await queryRunner.commitTransaction();
          this.logger.verbose(
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
                if (eventData.isRealTime) {
                  await queryRunner.manager
                    .createQueryBuilder()
                    .update(BlockchainEvent)
                    .set({ isRealTime: true })
                    .where({
                      transactionHash: eventData.transactionHash,
                      logIndex: eventData.logIndex,
                      blockchain: { id: eventData.blockchain.id },
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

    // Return results
    return {
      successCount,
      errorCount,
      totalEvents: events.length,
    };
  }
}
