import { Injectable, Logger } from '@nestjs/common';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { DecayRateEvent } from '../interfaces/decay-rate-event.interface';
import { BlockchainStateRecord } from '../interfaces/blockchain-state-record.interface';
import { sortDecayRateEvents } from '../utils/event-utils';
import { QueryRunner } from 'typeorm';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { EventDataGuards } from '../interfaces/event-data.interface';
import { EVENT_TYPES } from '../constants/event-processing.constants';

@Injectable()
export class DecayRateService {
  private readonly logger = new Logger(DecayRateService.name);

  constructor() {}

  /**
   * Extracts decay rate events from an array of blockchain events.
   *
   * @param events Array of blockchain events to process
   * @returns Array of decay rate events
   */
  extractDecayRateEvents(events: BlockchainEvent[]): DecayRateEvent[] {
    this.logger.debug(
      `Extracting decay rate events from ${events.length} events`,
    );

    const decayRateEvents: DecayRateEvent[] = [];

    try {
      for (const event of events) {
        if (event.eventName === EVENT_TYPES.SET_DECAY_RATE) {
          try {
            const eventDataArray = event.eventData as unknown[];

            // Validate event data using type guards
            if (!EventDataGuards.isSetDecayRateEventData(eventDataArray)) {
              this.logger.warn(
                `SetDecayRate event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
              );
              continue; // Skip this event and continue processing others
            }

            const [decayRate] = eventDataArray;
            decayRateEvents.push({
              blockNumber: event.blockNumber,
              logIndex: event.logIndex,
              blockTimestamp: event.blockTimestamp,
              decayRate: decayRate,
            });

            this.logger.debug(
              `Found SetDecayRate event: ${decayRate} at block ${event.blockNumber}, logIndex ${event.logIndex}`,
            );
          } catch (error) {
            this.logger.error(
              `Error processing SetDecayRate event: ${error}`,
              error instanceof Error ? error.stack : undefined,
            );
            // Continue processing other events even if one fails
          }
        }
      }

      // Sort decay rate events by block number and log index
      const sortedEvents = sortDecayRateEvents(decayRateEvents);
      this.logger.debug(`Extracted ${sortedEvents.length} decay rate events`);

      return sortedEvents;
    } catch (error) {
      this.logger.error(
        `Error extracting decay rate events: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        'decay-rate-extraction',
        'DecayRateExtraction',
      );
      // This line is unreachable but satisfies TypeScript
      return [];
    }
  }

  /**
   * Gets the latest blockchain state from the database
   *
   * @param blockchainId ID of the blockchain to get the state for
   * @param queryRunner TypeORM QueryRunner for database operations
   * @returns The latest blockchain state record or null if not found
   */
  async getLatestBlockchainState(
    blockchainId: string,
    queryRunner: QueryRunner,
  ): Promise<BlockchainStateRecord | null> {
    try {
      this.logger.debug(
        `Getting latest blockchain state for blockchain: ${blockchainId}`,
      );

      const result: unknown = await queryRunner.query(
        `SELECT * FROM blockchain_state
        WHERE "blockchainId" = $1
        ORDER BY "blockNumber" DESC
        LIMIT 1`,
        [blockchainId],
      );

      // Type guard to check if result is an array with at least one element
      if (Array.isArray(result) && result.length > 0) {
        const stateRecord = result[0] as BlockchainStateRecord;
        this.logger.debug(
          `Found blockchain state record for block ${stateRecord.blockNumber}`,
        );
        return stateRecord;
      }

      this.logger.debug(
        `No blockchain state record found for blockchain: ${blockchainId}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get latest blockchain state: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'get latest blockchain state',
      );
      // This line is unreachable but satisfies TypeScript
      return null;
    }
  }
}
