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
import { NotificationsService } from 'src/notifications/notifications.service';
import { ContractsUtilsService } from 'src/contracts/contracts.utils.service';

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
    private notificationsService: NotificationsService,
    private contractsUtilsService: ContractsUtilsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Alert monitoring system initialized.');
    await Promise.resolve();
  }

  /**
   * Event handler for blockchain events
   * Triggers alerts based on blockchain events
   */
  @OnEvent('blockchain.event.stored')
  async handleBlockchainEventAlerts(payload: {
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
  async handleRealTimeDataAlerts(): Promise<void> {
    this.logger.log('Checking real-time data alerts...');
    const blockchains = await this.blockchainRepository.find({});

    for (const blockchain of blockchains) {
      await this.processRealTimeDataAlerts(blockchain);
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
    this.logger.log(`Processing DeleteBid event with id: ${event.id}`);
    // Fetch Alerts to trigger
    // For each enabled alert, send notification to users.
    // this.notificationsService.sendNotifications(event);
  }

  private async processRealTimeDataAlerts(blockchain: Blockchain) {
    // Fetch Alerts to trigger
    // For each enabled alert, send notification to users.
    // this.notificationsService.sendNotifications(event);
    try {
      const bidSafetyAlerts = await this.alertsRepository.find({
        where: {
          type: AlertType.BID_SAFETY,
          isActive: true,
          userContract: {
            blockchain: { id: blockchain.id },
          },
        },
        relations: [
          'userContract',
          'userContract.contract',
          'userContract.contract.blockchain',
        ],
      });

      this.logger.log(
        `Found ${bidSafetyAlerts.length} active bidSafety alerts`,
      );

      const cacheManagerInstance = this.providerManager.getContract(blockchain);

      for (const alert of bidSafetyAlerts) {
        const minBid = (await cacheManagerInstance[
          'getMinBid(address program)'
        ](alert.userContract.address)) as bigint;

        const effectiveBid = BigInt(
          await this.contractsUtilsService.calculateEffectiveBid(
            alert.userContract.contract,
          ),
        );

        const alertValueBigInt = BigInt(Math.round(Number(alert.value) * 100));
        const basePercentage = BigInt(10000); // 100% represented as 10000 for BigInt precision
        const multiplier = basePercentage + alertValueBigInt;
        const threshold = (minBid * multiplier) / basePercentage;

        if (effectiveBid < threshold) {
          this.notificationsService.sendNotifications(alert);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error checking real-time alerts: ${errorMessage}`);
    }
  }
}
