import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';
import { ethers } from 'ethers';
import { isMoreRecentEvent } from '../utils/event-utils';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
@Injectable()
export class DeleteBidService {
  private readonly logger = new Logger(DeleteBidService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
  ) {}

  /**
   * Process a DeleteBid event and update the contract bytecode state map
   *
   * @param event The DeleteBid event to process
   * @param contractBytecodeStates Map of contract bytecode states to update
   */
  async processDeleteBidEvent(
    event: BlockchainEvent,
    contractBytecodeStates: Map<string, ContractBytecodeState>,
  ): Promise<void> {
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
    // Not used, but kept for completeness and future reference
    // const size = Number(eventDataArray[2]);

    if (!codeHash) {
      this.logger.warn(`Missing codehash in DeleteBid event`);
      return;
    }

    // Parse the eviction bid value from the DeleteBid event
    const evictionBid = parseFloat(ethers.formatEther(bidValue));

    let existingState = contractBytecodeStates.get(codeHash);

    // If no existingState in memory, try to find the contract bytecode in the database
    if (!existingState) {
      try {
        // Make sure we have a valid blockchain object
        if (!event.blockchain || !event.blockchain.id) {
          this.logger.error(
            `Missing blockchain information in event: ${JSON.stringify({
              eventId: event.id,
              blockNumber: event.blockNumber,
              logIndex: event.logIndex,
              eventName: event.eventName,
            })}`,
          );

          // Try to reload the event with blockchain relation
          try {
            const reloadedEvent = await this.blockchainEventRepository.findOne({
              where: { id: event.id },
              relations: ['blockchain'],
            });

            if (
              reloadedEvent &&
              reloadedEvent.blockchain &&
              reloadedEvent.blockchain.id
            ) {
              this.logger.log(
                `Successfully reloaded event ${event.id} with blockchain relation`,
              );
              event = reloadedEvent; // Replace the event with the reloaded one
            } else {
              this.logger.error(
                `Failed to reload event ${event.id} with blockchain relation`,
              );
              return;
            }
          } catch (reloadError) {
            this.logger.error(
              `Error reloading event ${event.id}: ${
                reloadError instanceof Error
                  ? reloadError.message
                  : String(reloadError)
              }`,
            );
            return;
          }
        }

        // Log the event data for debugging
        this.logger.debug(
          `Looking up previous InsertBid for contract bytecode ${codeHash} for blockchain ${event.blockchain.id}`,
        );

        // Look for the most recent InsertBid event for this contract bytecode
        // We need to craft a better query since the eventData is stored as a JSON array
        // and we need to match the contract hash as the first element
        const previousInsertBid = await this.blockchainEventRepository
          .createQueryBuilder('event')
          .where('event.eventName = :eventName', { eventName: 'InsertBid' })
          .andWhere('event.blockchainId = :blockchainId', {
            blockchainId: event.blockchain.id,
          })
          .andWhere('CAST(event.eventData AS TEXT) LIKE :codeHash', {
            codeHash: `%${codeHash}%`,
          })
          .orderBy('event.blockNumber', 'DESC')
          .addOrderBy('event.logIndex', 'DESC')
          .getOne();

        if (previousInsertBid) {
          this.logger.debug(
            `Found previous InsertBid for contract bytecode ${codeHash} at block ${previousInsertBid.blockNumber}`,
          );

          // Extract data from the found InsertBid event
          const insertBidDataArray = previousInsertBid.eventData as unknown[];
          if (
            Array.isArray(insertBidDataArray) &&
            insertBidDataArray.length >= 4
          ) {
            const address = String(insertBidDataArray[1]);
            const bidValue = String(insertBidDataArray[2]);
            const size = Number(insertBidDataArray[3]);

            // Create a minimal state for this contract bytecode
            existingState = {
              isCached: true,
              bid: parseFloat(ethers.formatEther(bidValue)),
              bidPlusDecay: parseFloat(ethers.formatEther(bidValue)), // Simple approximation
              size,
              address,
              lastEventBlock: previousInsertBid.blockNumber,
              lastEventName: 'InsertBid',
              totalBidInvestment: parseFloat(ethers.formatEther(bidValue)),
            };

            // Add to the contract states map
            contractBytecodeStates.set(codeHash, existingState);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error looking up previous InsertBid for contract ${codeHash}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        // Try a different approach with direct SQL if the query builder fails
        try {
          this.logger.debug(
            `Trying fallback query for previous InsertBid for contract ${codeHash}`,
          );

          // Make sure we have a valid blockchain ID
          if (!event.blockchain?.id) {
            this.logger.error('Missing blockchain ID in fallback query');
            return;
          }

          // Direct SQL query to find the InsertBid
          const rawResults = (await this.blockchainEventRepository.query(
            `SELECT * FROM blockchain_event 
             WHERE "blockchainId" = $1 
             AND "eventName" = 'InsertBid' 
             AND "eventData"::text LIKE $2
             ORDER BY "blockNumber" DESC, "logIndex" DESC
             LIMIT 1`,
            [event.blockchain.id, `%${codeHash}%`],
          )) as Array<{
            id: string;
            blockchainId: string;
            eventName: string;
            blockNumber: number;
            logIndex: number;
            eventData: unknown;
          }>;

          if (rawResults && rawResults.length > 0) {
            const previousInsertBid = rawResults[0];
            this.logger.debug(
              `Found previous InsertBid using fallback query for contract ${codeHash} at block ${previousInsertBid.blockNumber}`,
            );

            // Parse the event data - it might be a string or already an object
            let insertBidDataArray: unknown[];
            if (typeof previousInsertBid.eventData === 'string') {
              try {
                insertBidDataArray = JSON.parse(
                  previousInsertBid.eventData,
                ) as unknown[];
              } catch {
                this.logger.error('Failed to parse eventData JSON');
                return;
              }
            } else {
              insertBidDataArray = previousInsertBid.eventData as unknown[];
            }

            if (
              Array.isArray(insertBidDataArray) &&
              insertBidDataArray.length >= 4
            ) {
              const address = String(insertBidDataArray[1]);
              const bidValue = String(insertBidDataArray[2]);
              const size = Number(insertBidDataArray[3]);

              // Create a minimal state for this contract bytecode
              existingState = {
                isCached: true,
                bid: parseFloat(ethers.formatEther(bidValue)),
                bidPlusDecay: parseFloat(ethers.formatEther(bidValue)), // Simple approximation
                size,
                address,
                lastEventBlock: previousInsertBid.blockNumber,
                lastEventName: 'InsertBid',
                totalBidInvestment: parseFloat(ethers.formatEther(bidValue)),
              };

              // Add to the contract bytecode states map
              contractBytecodeStates.set(codeHash, existingState);
            }
          }
        } catch (fallbackError) {
          this.logger.error(
            `Fallback query also failed for contract bytecode ${codeHash}: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError)
            }`,
          );
        }
      }
    }

    // Check if this event is more recent than what we have
    const shouldUpdate = isMoreRecentEvent(
      event,
      existingState?.lastEventBlock,
    );

    if (shouldUpdate) {
      if (!existingState) {
        this.logger.warn(
          `Received DeleteBid for contract bytecode ${codeHash} without prior InsertBid in memory. Attempting to create a minimal state.`,
        );

        // Create a minimal contract bytecode state to track that this contract bytecode has been deleted
        // This prevents issues with future DeleteBid events for the same contract bytecode
        existingState = {
          isCached: false,
          bid: 0, // No bid information available
          bidPlusDecay: 0, // No bid information available
          size: 0, // Unknown size
          address: '', // Unknown address
          lastEvictionBid: evictionBid, // Store the eviction bid value from this event
          lastEventBlock: event.blockNumber,
          lastEventName: 'DeleteBid',
          totalBidInvestment: 0, // No investment information available
        };

        // Add to contract bytecode states map to track this contract bytecode
        contractBytecodeStates.set(codeHash, existingState);

        this.logger.debug(
          `Created minimal state for previously unknown contract bytecode ${codeHash} based on DeleteBid at block ${event.blockNumber}`,
        );
        return;
      }

      // Update contract bytecode state, marking as not cached since this is a DeleteBid event
      // IMPORTANT: Keep existing values for bid, bidPlusDecay, and totalBidInvestment
      contractBytecodeStates.set(codeHash, {
        isCached: false, // DeleteBid means the contract bytecode is no longer cached
        bid: existingState.bid, // Keep existing bid value
        bidPlusDecay: existingState.bidPlusDecay, // Keep existing bidPlusDecay value
        lastEvictionBid: evictionBid, // Store the eviction bid value
        size: existingState.size, // Keep existing size
        address: existingState.address,
        lastEventBlock: event.blockNumber,
        lastEventName: 'DeleteBid',
        totalBidInvestment: existingState.totalBidInvestment, // Keep existing total investment
      });

      this.logger.debug(
        `DeleteBid: Contract bytecode ${codeHash} removed from cache at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          `, keeping bid: ${existingState.bid}, bidPlusDecay: ${existingState.bidPlusDecay}, totalBidInvestment: ${existingState.totalBidInvestment}` +
          `, lastEvictionBid: ${evictionBid}`,
      );
    } else {
      this.logger.debug(
        `Skipping older DeleteBid event for contract bytecode ${codeHash} at block ${event.blockNumber}` +
          (event.logIndex !== undefined
            ? ` (logIndex: ${event.logIndex})`
            : '') +
          ` (already have event from block ${existingState?.lastEventBlock})`,
      );
    }
  }

  async processDeleteBidEvent2(blockchain: Blockchain, event: BlockchainEvent) {
    this.logger.debug(
      `Processing DeleteBid event for blockchain ${blockchain.name}`,
    );

    const eventDataArray = event.eventData as unknown[];

    if (!Array.isArray(eventDataArray) || eventDataArray.length < 3) {
      this.logger.warn(
        `DeleteBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
      );
      return;
    }

    const bytecodeHash = String(eventDataArray[0]);
    const bidValue = String(eventDataArray[1]);
    // Not used, but kept for completeness and future reference
    // const size = Number(eventDataArray[2]);

    // If no codehash in bytecode db, create new entry
    const existingBytecode = await this.bytecodeRepository.findOne({
      where: { blockchain, bytecodeHash },
    });

    if (!existingBytecode) {
      this.logger.error(
        `A DeleteBid event was received for ${bytecodeHash}, but no bytecode was found in the database.`,
      );
      return;
    }

    // If bytecode exists, update bid, bidPlusDecay, size, totalBidInvestment, cacheStatus
    existingBytecode.lastEvictionBid = bidValue;
    existingBytecode.isCached = false;
    await this.bytecodeRepository.save(existingBytecode);
  }
}
