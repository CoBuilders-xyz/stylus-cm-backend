import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CmaConfig } from './cma.config';
import { AutomationOrchestratorService } from './services';

@Injectable()
export class CmaService implements OnModuleInit {
  private readonly logger = new Logger(CmaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly automationOrchestratorService: AutomationOrchestratorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCmaAutomation(): Promise<void> {
    const config = this.configService.get<CmaConfig>('cma');

    if (!config?.automationEnabled) {
      this.logger.debug('CMA automation is disabled via configuration');
      return;
    }

    try {
      const result =
        await this.automationOrchestratorService.executeAutomation();

      if (result.success) {
        this.logger.log(
          `CMA automation completed successfully. Processed ${result.stats.processedContracts} contracts across ${result.stats.processedBlockchains} blockchains.`,
        );
      } else {
        this.logger.warn(
          `CMA automation completed with ${result.errors.length} errors. Processed ${result.stats.processedContracts} contracts across ${result.stats.processedBlockchains} blockchains.`,
        );
      }
    } catch (error) {
      this.logger.error('CMA automation failed:', error);
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('CMA automation system initialized.');
    await Promise.resolve();
  }
}
