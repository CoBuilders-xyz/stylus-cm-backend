import { Injectable, Logger } from '@nestjs/common';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { DecayRateEvent } from '../interfaces/decay-rate-event.interface';
import { BlockchainStateRecord } from '../interfaces/blockchain-state-record.interface';
import { sortDecayRateEvents } from '../utils/event-utils';
import { QueryRunner } from 'typeorm';

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
    const decayRateEvents: DecayRateEvent[] = [];

    for (const event of events) {
      if (event.eventName === 'SetDecayRate') {
        try {
          const eventDataArray = event.eventData as unknown[];
          if (Array.isArray(eventDataArray) && eventDataArray.length > 0) {
            const decayRate = String(eventDataArray[0]);
            decayRateEvents.push({
              blockNumber: event.blockNumber,
              logIndex: event.logIndex,
              blockTimestamp: event.blockTimestamp,
              decayRate: decayRate,
            });
            this.logger.debug(
              `Found SetDecayRate event: ${decayRate} at block ${event.blockNumber}, logIndex ${event.logIndex}`,
            );
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Error processing SetDecayRate event: ${errorMessage}`,
          );
        }
      }
    }

    // Sort decay rate events by block number and log index
    return sortDecayRateEvents(decayRateEvents);
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
      const result: unknown = await queryRunner.query(
        `SELECT * FROM blockchain_state
        WHERE "blockchainId" = $1
        ORDER BY "blockNumber" DESC
        LIMIT 1`,
        [blockchainId],
      );

      // Type guard to check if result is an array with at least one element
      if (Array.isArray(result) && result.length > 0) {
        return result[0] as BlockchainStateRecord;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get latest blockchain state: ${error}`);
      throw error;
    }
  }
}
