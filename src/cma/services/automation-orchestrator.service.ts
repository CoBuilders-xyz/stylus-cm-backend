import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { CmaConfig } from '../cma.config';
import { ContractSelectionService } from './contract-selection.service';
import { ActivationSelectionService } from './activation-selection.service';
import { BatchProcessorService } from './batch-processor.service';
import {
  AutomationResult,
  AutomationStats,
  BatchProcessingResult,
} from '../interfaces';
import { MODULE_NAME } from '../constants';

type BlockchainProcessor = (
  blockchain: Blockchain,
) => Promise<BatchProcessingResult>;

@Injectable()
export class AutomationOrchestratorService {
  private readonly logger = createModuleLogger(
    AutomationOrchestratorService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
    private readonly contractSelectionService: ContractSelectionService,
    private readonly activationSelectionService: ActivationSelectionService,
    private readonly batchProcessorService: BatchProcessorService,
  ) {}

  async executeCachingAutomation(): Promise<AutomationResult> {
    const config = this.configService.get<CmaConfig>('cma');

    if (!config?.cachingAutomationEnabled) {
      this.logger.log('Caching automation is disabled');
      return this.emptyResult();
    }

    return this.runForAllBlockchains('caching', (blockchain) =>
      this.processCaching(blockchain),
    );
  }

  async executeActivationAutomation(): Promise<AutomationResult> {
    const config = this.configService.get<CmaConfig>('cma');

    if (!config?.activationAutomationEnabled) {
      this.logger.log('Activation automation is disabled');
      return this.emptyResult();
    }

    return this.runForAllBlockchains('activation', (blockchain) =>
      this.processActivation(blockchain),
    );
  }

  private async runForAllBlockchains(
    label: string,
    processor: BlockchainProcessor,
  ): Promise<AutomationResult> {
    const startTime = new Date();

    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

    if (blockchains.length === 0) {
      this.logger.log(`No enabled blockchains for ${label} automation`);
      return this.emptyResult();
    }

    this.logger.log(
      `Running ${label} automation for ${blockchains.length} blockchains`,
    );

    let totalContracts = 0;
    let processedContracts = 0;
    let successfulBatches = 0;
    let failedBatches = 0;
    let processedBlockchains = 0;
    const errors: Array<{
      blockchain: string;
      error: string;
      timestamp: Date;
    }> = [];

    for (const blockchain of blockchains) {
      try {
        const result = await processor(blockchain);

        totalContracts += result.totalContracts;
        processedContracts += result.processedContracts;
        successfulBatches += result.successfulBatches;
        failedBatches += result.failedBatches;
        processedBlockchains++;

        if (result.errors.length > 0) {
          for (const error of result.errors) {
            errors.push({
              blockchain: blockchain.name,
              error,
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        const errorMessage = `${label} automation failed for ${blockchain.name}: ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(errorMessage);
        errors.push({
          blockchain: blockchain.name,
          error: errorMessage,
          timestamp: new Date(),
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const stats: AutomationStats = {
      totalBlockchains: blockchains.length,
      processedBlockchains,
      totalContracts,
      processedContracts,
      successfulBatches,
      failedBatches,
      startTime,
      endTime,
      duration,
    };

    this.logger.log(
      `${label} automation completed: ${processedContracts} contracts across ${processedBlockchains} blockchains`,
    );

    return { success: errors.length === 0, stats, errors };
  }

  private async processCaching(
    blockchain: Blockchain,
  ): Promise<BatchProcessingResult> {
    const selectedContracts =
      await this.contractSelectionService.selectOptimalBids(blockchain);

    if (selectedContracts.length === 0) {
      this.logger.log(
        `No contracts selected for caching on ${blockchain.name}`,
      );
      return this.emptyBatchResult();
    }

    return this.batchProcessorService.processContractBatches(
      blockchain,
      selectedContracts,
    );
  }

  private async processActivation(
    blockchain: Blockchain,
  ): Promise<BatchProcessingResult> {
    const result =
      await this.activationSelectionService.selectOptimalActivations(
        blockchain,
      );

    if (result.selectedContracts.length === 0) {
      this.logger.log(
        `No contracts selected for activation on ${blockchain.name}`,
      );
      return this.emptyBatchResult();
    }

    return this.batchProcessorService.processActivationBatches(
      blockchain,
      result.selectedContracts,
      result.maxActivationsPerIteration,
    );
  }

  private emptyResult(): AutomationResult {
    return {
      success: true,
      stats: {
        totalBlockchains: 0,
        processedBlockchains: 0,
        totalContracts: 0,
        processedContracts: 0,
        successfulBatches: 0,
        failedBatches: 0,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
      },
      errors: [],
    };
  }

  private emptyBatchResult(): BatchProcessingResult {
    return {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalContracts: 0,
      processedContracts: 0,
      results: [],
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0,
      errors: [],
    };
  }
}
