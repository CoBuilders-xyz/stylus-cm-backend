import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Alert } from '../entities/alert.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { AlertConditionEvaluatorService } from './alert-condition-evaluator.service';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME, AlertType } from '../constants';

@Injectable()
export class AlertSchedulerService {
  private readonly logger = createModuleLogger(
    AlertSchedulerService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    private alertConditionEvaluator: AlertConditionEvaluatorService,
    @InjectQueue('alerts') private alertsQueue: Queue,
  ) {}

  /**
   * Process real-time data alerts for all enabled blockchains
   */
  async scheduleRealTimeMonitoring(): Promise<void> {
    try {
      this.logger.log('Checking real-time data alerts...');

      const blockchains = await this.blockchainRepository.find({
        where: { enabled: true },
      });

      this.logger.debug(`Found ${blockchains.length} enabled blockchains`);

      for (const blockchain of blockchains) {
        await this.processRealTimeDataAlerts(blockchain);
      }

      this.logger.log(
        `Completed real-time alert processing for ${blockchains.length} blockchains`,
      );
    } catch (error) {
      this.logger.error(
        `Error in scheduled real-time monitoring: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Process real-time alerts for a specific blockchain
   */
  private async processRealTimeDataAlerts(
    blockchain: Blockchain,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Processing real-time alerts for blockchain ${blockchain.id}`,
      );

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
          'userContract.contract.bytecode',
        ],
      });

      this.logger.log(
        `Found ${bidSafetyAlerts.length} active bidSafety alerts for blockchain ${blockchain.id}`,
      );

      let triggeredCount = 0;

      for (const alert of bidSafetyAlerts) {
        try {
          const shouldTrigger =
            await this.alertConditionEvaluator.evaluateBidSafetyCondition(
              alert,
              blockchain,
            );

          if (shouldTrigger) {
            await this.alertsQueue.add('alert-triggered', {
              alertId: alert.id,
            });
            triggeredCount++;
          }
        } catch (error) {
          this.logger.error(
            `Error processing individual bid safety alert ${alert.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? error.stack : undefined,
          );
          continue; // Continue processing other alerts
        }
      }

      if (triggeredCount > 0) {
        this.logger.log(
          `Triggered ${triggeredCount}/${bidSafetyAlerts.length} bid safety alerts for blockchain ${blockchain.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking real-time alerts for blockchain ${blockchain.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
