import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventProcessorService } from './services/event-processor.service';
import { OnEvent } from '@nestjs/event-emitter';
/**
 * Main service for processing blockchain event data.
 * This service acts as a façade for the underlying specialized services,
 * coordinating the initial data processing and scheduling regular updates.
 */
@Injectable()
export class DataProcessingService implements OnModuleInit {
  private readonly logger = new Logger(DataProcessingService.name);
  private isInitialProcessingComplete = false;

  constructor(private readonly eventProcessorService: EventProcessorService) {}

  /**
   * Event handler for new blockchain events
   * This is triggered whenever a new event is stored in the database
   */
  @OnEvent('blockchain.event.stored')
  async handleNewBlockchainEvent(payload: {
    blockchainId: string;
    eventId: string;
  }): Promise<void> {
    if (!this.isInitialProcessingComplete) {
      this.logger.debug(
        `Skipping event processing for ${payload.eventId} as initial processing is not complete`,
      );
      return;
    }

    this.logger.log(
      `Received notification of new blockchain event: ${payload.eventId}`,
    );
    await this.processNewEvent(payload.blockchainId, payload.eventId);
  }

  /**
   * Initializes the data processing service on module initialization.
   * Waits a brief period to ensure database connections are established
   * before starting the initial event processing.
   */
  onModuleInit() {
    this.logger.log('Initializing blockchain event processor...');
    // TODO: Make a check instead of timeout

    this.processAllEvents().catch((err: Error) =>
      this.logger.error(
        `Failed during initial event processing: ${err.message}`,
      ),
    );
  }

  /**
   * Process all blockchain events across all blockchains.
   * This is used for the initial processing when the service starts.
   */
  async processAllEvents(): Promise<void> {
    try {
      this.logger.log('Starting full event processing...');

      // Delegate to the specialized EventProcessorService
      await this.eventProcessorService.processAllEvents();
      this.isInitialProcessingComplete = true;
      this.logger.log('Initial event processing completed successfully.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing all events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process new events that have appeared since the last processing run.
   * Used by the scheduled task to keep the database updated.
   */
  async processNewEvent(blockchainId: string, eventId: string): Promise<void> {
    try {
      this.logger.log('Processing new event...');

      // Delegate to the specialized EventProcessorService
      await this.eventProcessorService.processNewEvent(blockchainId, eventId);

      this.logger.log('New event processing completed successfully.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing new events: ${errorMessage}`);
      throw error;
    }
  }
}
