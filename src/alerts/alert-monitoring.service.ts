import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertEventProcessorService } from './services/alert-event-processor.service';
import { AlertSchedulerService } from './services/alert-scheduler.service';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from './constants';

/**
 * Service responsible for coordinating alert monitoring:
 * 1. Blockchain events (event-based alerts)
 * 2. Real-time data checks (polling-based alerts)
 */
@Injectable()
export class AlertMonitoringService implements OnModuleInit {
  private readonly logger = createModuleLogger(
    AlertMonitoringService,
    MODULE_NAME,
  );

  constructor(
    private readonly eventProcessor: AlertEventProcessorService,
    private readonly scheduler: AlertSchedulerService,
  ) {}

  /**
   * Event handler for blockchain events
   * Delegates to specialized event processor
   */
  @OnEvent('blockchain.event.stored')
  async handleBlockchainEventAlerts(payload: {
    blockchainId: string;
    eventId: string;
  }): Promise<void> {
    this.logger.debug(
      `Coordinating blockchain event alert processing for event ${payload.eventId}`,
    );

    return this.eventProcessor.processBlockchainEvent(payload);
  }

  /**
   * Checks for real-time data alerts
   * Delegates to specialized scheduler service
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRealTimeDataAlerts(): Promise<void> {
    this.logger.debug('Coordinating real-time data alert processing');

    return this.scheduler.scheduleRealTimeMonitoring();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Alert monitoring system initialized');
    await Promise.resolve();
  }
}
