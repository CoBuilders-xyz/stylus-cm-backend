import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { CmaConfig } from '../cma.config';
import { ContractSelectionService } from './contract-selection.service';
import { BatchProcessorService } from './batch-processor.service';
import { AutomationResult, AutomationStats } from '../interfaces';

@Injectable()
export class AutomationOrchestratorService {
  private readonly logger = new Logger(AutomationOrchestratorService.name);

  constructor(
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
    private readonly configService: ConfigService,
    private readonly contractSelectionService: ContractSelectionService,
    private readonly batchProcessorService: BatchProcessorService,
  ) {}

  async executeAutomation(): Promise<AutomationResult> {
    const config = this.configService.get<CmaConfig>('cma');
    const startTime = new Date();

    this.logger.log('CMA automation started.');

    if (!config?.automationEnabled) {
      this.logger.log('CMA automation is disabled via configuration');
      return {
        success: true,
        stats: {
          totalBlockchains: 0,
          processedBlockchains: 0,
          totalContracts: 0,
          processedContracts: 0,
          successfulBatches: 0,
          failedBatches: 0,
          startTime,
          endTime: new Date(),
          duration: 0,
        },
        errors: [],
      };
    }

    const blockchains = await this.blockchainRepository.find({
      where: { enabled: true },
    });

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
        const result = await this.processCmaAutomation(blockchain);

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
        const errorMessage = `Failed to process automation for blockchain ${blockchain.name}: ${error}`;
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
      `CMA automation completed. Stats: ${JSON.stringify(stats)}`,
    );

    return {
      success: errors.length === 0,
      stats,
      errors,
    };
  }

  private async processCmaAutomation(blockchain: Blockchain) {
    this.logger.log(`Processing CMA automation for ${blockchain.name}`);

    const selectedContracts =
      await this.contractSelectionService.selectOptimalBids(blockchain);

    if (selectedContracts.length === 0) {
      this.logger.log(
        `No contracts selected for automation on ${blockchain.name}`,
      );
      return {
        totalContracts: 0,
        processedContracts: 0,
        successfulBatches: 0,
        failedBatches: 0,
        errors: [],
      };
    }

    const batchResult = await this.batchProcessorService.processContractBatches(
      blockchain,
      selectedContracts,
    );

    this.logger.log(
      `Completed automation for ${blockchain.name}: ${batchResult.processedContracts}/${batchResult.totalContracts} contracts processed`,
    );

    return batchResult;
  }
}
