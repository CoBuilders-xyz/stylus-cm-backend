import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventProcessorService } from './services/event-processor.service';

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
   * Initializes the data processing service on module initialization.
   * Waits a brief period to ensure database connections are established
   * before starting the initial event processing.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing blockchain event processor...');

    // TODO: Make a check instead of timeout
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
  async processNewEvents(): Promise<void> {
    try {
      this.logger.log('Processing new events...');

      // Delegate to the specialized EventProcessorService
      await this.eventProcessorService.processNewEvents();

      this.logger.log('New event processing completed successfully.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing new events: ${errorMessage}`);
      throw error;
    }
  }

  // Archive
  // /**
  //  * Scheduled task that runs every minute to process any new events.
  //  * Only runs after the initial processing is complete.
  //  */
  // @Interval(60000) // Run every minute
  // async scheduledEventProcessing(): Promise<void> {
  //   // Only run scheduled processing after initial processing is complete
  //   if (this.isInitialProcessingComplete) {
  //     try {
  //       // Process any new events that were created since last check
  //       await this.processNewEvents();
  //     } catch (error: unknown) {
  //       const errorMessage =
  //         error instanceof Error ? error.message : String(error);
  //       this.logger.error(
  //         `Error in scheduled event processing: ${errorMessage}`,
  //       );
  //     }
  //   }
  // }
}
