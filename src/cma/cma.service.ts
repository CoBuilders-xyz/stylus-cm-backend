import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { createModuleLogger } from 'src/common/utils/logger.util';
import { CmaConfig } from './cma.config';
import { AutomationOrchestratorService } from './services';
import { MODULE_NAME } from './constants';

@Injectable()
export class CmaService implements OnModuleInit {
  private readonly logger = createModuleLogger(CmaService, MODULE_NAME);

  constructor(
    private readonly configService: ConfigService,
    private readonly automationOrchestratorService: AutomationOrchestratorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCmaAutomation(): Promise<void> {
    const config = this.configService.get<CmaConfig>('cma');

    if (!config?.automationEnabled) {
      return;
    }

    try {
      const result =
        await this.automationOrchestratorService.executeAutomation();

      if (result.success) {
        this.logger.log(
          `Automation completed: ${result.stats.processedContracts} contracts processed across ${result.stats.processedBlockchains} blockchains`,
        );
      } else {
        this.logger.warn(
          `Automation completed with ${result.errors.length} errors: ${result.stats.processedContracts} contracts processed across ${result.stats.processedBlockchains} blockchains`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Automation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('CMA automation system initialized');
    await Promise.resolve();
  }
}
