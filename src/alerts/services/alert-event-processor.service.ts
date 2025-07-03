import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Alert } from '../entities/alert.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME, AlertType } from '../constants';
import { AlertsErrorHelpers } from '../alerts.errors';

@Injectable()
export class AlertEventProcessorService {
  private readonly logger = createModuleLogger(
    AlertEventProcessorService,
    MODULE_NAME,
  );

  private processEvent: Record<
    string,
    (event: BlockchainEvent) => void | Promise<void>
  > = {
    DeleteBid: (event: BlockchainEvent) => this.processDeleteBidEvent(event),
    Default: (event: BlockchainEvent) => {
      this.logger.debug(
        `No event alert processor found for event ${event.eventName}, skipping`,
      );
    },
  };

  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(BlockchainEvent)
    private blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectQueue('alerts') private alertsQueue: Queue,
  ) {}

  /**
   * Process blockchain events for alert triggering
   */
  async processBlockchainEvent(payload: {
    blockchainId: string;
    eventId: string;
  }): Promise<void> {
    try {
      this.logger.debug(
        `Processing blockchain event: ${payload.eventId} from blockchain: ${payload.blockchainId}`,
      );

      const event = await this.blockchainEventRepository.findOne({
        where: { id: payload.eventId },
      });

      if (!event) {
        this.logger.warn(`Event with id ${payload.eventId} not found`);
        AlertsErrorHelpers.throwEventProcessingError(
          payload.eventId,
          'Event not found in database',
        );
        return;
      }

      const processor =
        this.processEvent[event.eventName || 'Default'] ||
        this.processEvent.Default;

      await processor(event);

      this.logger.log(
        `Successfully processed ${event.eventName} event ${payload.eventId} on blockchain ${payload.blockchainId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing blockchain event ${payload.eventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      AlertsErrorHelpers.throwEventProcessingError(
        payload.eventId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Process DeleteBid events for eviction alerts
   */
  private async processDeleteBidEvent(event: BlockchainEvent): Promise<void> {
    try {
      this.logger.debug(`Processing DeleteBid event with id: ${event.id}`);

      const deleteBidEvent = await this.blockchainEventRepository.findOne({
        where: { id: event.id },
      });

      if (!deleteBidEvent) {
        this.logger.warn(`DeleteBid event with id ${event.id} not found`);
        return;
      }

      const bytecodeHash = deleteBidEvent.eventData[0] as string;
      this.logger.debug(
        `Processing eviction alert for bytecode hash: ${bytecodeHash}`,
      );

      const alerts = await this.alertsRepository.find({
        where: {
          isActive: true,
          type: AlertType.EVICTION,
          userContract: {
            contract: { bytecode: { bytecodeHash: bytecodeHash } },
          },
        },
      });

      this.logger.log(
        `Found ${alerts.length} active eviction alerts for bytecode ${bytecodeHash}`,
      );

      // Queue alerts for notification
      for (const alert of alerts) {
        await this.alertsQueue.add('alert-triggered', {
          alertId: alert.id,
        });
      }

      if (alerts.length > 0) {
        this.logger.log(
          `Successfully queued ${alerts.length} eviction alerts for processing`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing DeleteBid event ${event.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
