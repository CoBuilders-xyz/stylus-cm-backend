import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { createModuleLogger } from 'src/common/utils/logger.util';
import { AutomationOrchestratorService } from './services';
import { MODULE_NAME } from './constants';

@Injectable()
export class CmaService implements OnModuleInit {
  private readonly logger = createModuleLogger(CmaService, MODULE_NAME);

  constructor(
    private readonly automationOrchestratorService: AutomationOrchestratorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCmaAutomation(): Promise<void> {
    await this.runAutomation('caching', () =>
      this.automationOrchestratorService.executeCachingAutomation(),
    );

    await this.runAutomation('activation', () =>
      this.automationOrchestratorService.executeActivationAutomation(),
    );
  }

  onModuleInit(): void {
    this.logger.log('CMA automation system initialized');
  }

  private async runAutomation(
    label: string,
    execute: () => ReturnType<
      AutomationOrchestratorService['executeCachingAutomation']
    >,
  ): Promise<void> {
    try {
      const result = await execute();

      if (result.stats.totalBlockchains === 0) return;

      if (result.success) {
        this.logger.log(
          `${label} automation: ${result.stats.processedContracts} contracts across ${result.stats.processedBlockchains} blockchains`,
        );
      } else {
        this.logger.warn(
          `${label} automation completed with ${result.errors.length} errors`,
        );
      }
    } catch (error) {
      this.logger.error(
        `${label} automation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
