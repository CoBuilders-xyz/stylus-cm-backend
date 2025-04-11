import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertType } from './entities/alert.entity';
import { Cron } from '@nestjs/schedule';
import { CronExpression } from '@nestjs/schedule';
import { ProviderManager } from '../common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
/**
 * Service responsible for monitoring and triggering alerts based on:
 * 1. Blockchain events (event-based alerts)
 * 2. Real-time data checks (polling-based alerts)
 */
@Injectable()
export class AlertMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(AlertMonitoringService.name);

  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    private providerManager: ProviderManager,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    @InjectRepository(BlockchainEvent)
    private blockchainEventRepository: Repository<BlockchainEvent>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Alert monitoring system initialized.');
  }

  /**
   * Event handler for blockchain events
   * Triggers alerts based on blockchain events
   */
  @OnEvent('blockchain.event.stored')
  async handleBlockchainEvent(payload: {
    blockchainId: string;
    eventId: string;
  }): Promise<void> {
    this.logger.log(
      `[Event-Based Alert] Processing blockchain event: ${payload.eventId} from blockchain: ${payload.blockchainId}`,
    );

    const event = await this.blockchainEventRepository.findOne({
      where: { id: payload.eventId },
    });

    const eventProcessor =
      this.processEvent[event?.eventName || 'Default'] ||
      this.processEvent.Default;
    await eventProcessor(event);
  }

  /**
   * Checks for real-time data alerts
   * This method could be called on a schedule via a cron job
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkRealTimeDataAlerts(): Promise<void> {
    this.logger.log('Checking real-time data alerts...');

    try {
      // Find all active bidSafety alerts
      const bidSafetyAlerts = await this.alertsRepository.find({
        where: {
          type: AlertType.BID_SAFETY,
          isActive: true,
        },
        relations: ['user', 'userContract'],
      });

      this.logger.log(
        `Found ${bidSafetyAlerts.length} active bidSafety alerts`,
      );

      bidSafetyAlerts.forEach(async (alert) => {
        this.logger.log(
          `[Real-Time Alert] BidSafety alert for user: ${alert.user.id}, contract: ${alert.userContract?.id}, value: ${alert.value}`,
        );
        const minBid = await this.providerManager
          .getContract(alert.userContract.blockchain)
          .getMinBid(alert.userContract.id);

        if (minBid < alert.value) {
          // Notify User
          // Update alert lastTriggered and triggerCount
        }
      });
    } catch (error) {
      this.logger.error(`Error checking real-time alerts: ${error.message}`);
    }
  }

  private processEvent = {
    DeleteBid: (event: BlockchainEvent) => this.processDeleteBidEvent(event),
    Default: (event: BlockchainEvent) => {
      this.logger.debug(
        `No event alert processor found for event ${event.eventName}, skipping`,
      );
    },
  };

  private processDeleteBidEvent(event: BlockchainEvent) {
    this.logger.log(`DeleteBid event for alerts `);
  }
}
