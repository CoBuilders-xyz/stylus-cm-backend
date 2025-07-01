import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { EventDataGuards } from '../interfaces/event-data.interface';

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
   * Process a DeleteBid event and update the bytecode state
   *
   * @param blockchain The blockchain context
   * @param event The DeleteBid event to process
   */
  async processDeleteBidEvent(
    blockchain: Blockchain,
    event: BlockchainEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing DeleteBid event for blockchain ${blockchain.name}`,
    );

    try {
      const eventDataArray = event.eventData as unknown[];

      // Validate event data using type guards
      if (!EventDataGuards.isDeleteBidEventData(eventDataArray)) {
        this.logger.warn(
          `DeleteBid event data is not in the expected format: ${JSON.stringify(event.eventData)}`,
        );
        DataProcessingErrorHelpers.throwInvalidEventData(
          event.id,
          'DeleteBid',
          event.eventData,
        );
        return;
      }

      const [bytecodeHash] = eventDataArray;

      this.logger.debug(`Processing DeleteBid for bytecode ${bytecodeHash}`);

      // Find existing bytecode
      const existingBytecode = await this.bytecodeRepository.findOne({
        where: {
          blockchain: { id: blockchain.id },
          bytecodeHash,
        },
      });

      if (!existingBytecode) {
        this.logger.error(
          `A DeleteBid event was received for ${bytecodeHash}, but no bytecode was found in the database.`,
        );
        DataProcessingErrorHelpers.throwDatabaseOperationFailed(
          `bytecode not found for DeleteBid: ${bytecodeHash}`,
        );
        return;
      }

      // Update bytecode state for deletion
      await this.updateBytecodeForDeletion(existingBytecode, bytecodeHash);

      this.logger.log(
        `Successfully processed DeleteBid event for bytecode ${bytecodeHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing DeleteBid event: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwEventProcessingFailed(
        event.id,
        'DeleteBid',
      );
    }
  }

  /**
   * Update bytecode entity for deletion
   */
  private async updateBytecodeForDeletion(
    bytecode: Bytecode,
    bytecodeHash: string,
  ): Promise<void> {
    try {
      // Update bytecode state for deletion
      bytecode.isCached = false;
      // Note: We don't set lastEvictionBid here as it's not provided in the event data
      // The bid value from the event data is not used in the current implementation

      await this.bytecodeRepository.save(bytecode);
      this.logger.debug(`Updated bytecode ${bytecodeHash} for deletion`);
    } catch (error) {
      this.logger.error(
        `Error updating bytecode for deletion: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      DataProcessingErrorHelpers.throwDatabaseOperationFailed(
        'bytecode deletion update',
      );
    }
  }
}
