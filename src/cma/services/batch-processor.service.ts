import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { EngineUtil } from '../utils/engine.util';
import { CmaConfig } from '../cma.config';
import {
  SelectedContract,
  BatchProcessingResult,
  BatchResult,
} from '../interfaces';
import { MODULE_NAME } from '../constants';

@Injectable()
export class BatchProcessorService {
  private readonly logger = createModuleLogger(
    BatchProcessorService,
    MODULE_NAME,
  );

  constructor(
    private readonly engineUtil: EngineUtil,
    private readonly configService: ConfigService,
  ) {}

  async processContractBatches(
    blockchain: Blockchain,
    selectedContracts: SelectedContract[],
  ): Promise<BatchProcessingResult> {
    const config = this.configService.get<CmaConfig>('cma');
    const batchSize = config?.batchSize || 50;
    const startTime = new Date();

    if (selectedContracts.length === 0) {
      return {
        totalBatches: 0,
        successfulBatches: 0,
        failedBatches: 0,
        totalContracts: 0,
        processedContracts: 0,
        results: [],
        startTime,
        endTime: new Date(),
        totalDuration: 0,
        errors: [],
      };
    }

    // Process contracts in batches
    const batches: SelectedContract[][] = [];
    for (let i = 0; i < selectedContracts.length; i += batchSize) {
      batches.push(selectedContracts.slice(i, i + batchSize));
    }

    this.logger.log(
      `Processing ${selectedContracts.length} contracts in ${batches.length} batches for ${blockchain.name}`,
    );

    let successfulBatches = 0;
    let failedBatches = 0;
    let processedContracts = 0;
    const results: BatchResult[] = [];
    const errors: string[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = new Date();

      try {
        // Prepare arguments for placeBids function - array of [user, contractAddress] tuples
        const contractArgs = batch.map((contract) => [
          contract.user,
          contract.address,
        ]);

        this.logger.log(
          `Attempting to call placeBids for batch ${batchIndex + 1}/${batches.length} with ${contractArgs.length} contracts`,
        );

        const result = await this.engineUtil.writeContract(
          blockchain.chainId,
          blockchain.cacheManagerAutomationAddress,
          {
            functionName: 'function placeBids((address,address)[])',
            args: [contractArgs],
          },
        );

        const batchEndTime = new Date();
        const processingTime =
          batchEndTime.getTime() - batchStartTime.getTime();

        this.logger.log(
          `Batch ${batchIndex + 1}/${batches.length} placeBids result: ${JSON.stringify(result)}`,
        );

        results.push({
          batchIndex,
          success: true,
          processedContracts: batch.length,
          retryCount: 0,
          processingTime,
          queueId: result.queueId,
        });

        successfulBatches++;
        processedContracts += batch.length;
      } catch (error) {
        const batchEndTime = new Date();
        const processingTime =
          batchEndTime.getTime() - batchStartTime.getTime();
        const errorMessage = `Batch ${batchIndex + 1}/${batches.length} failed: ${error instanceof Error ? error.message : String(error)}`;

        this.logger.error(errorMessage);
        errors.push(errorMessage);

        results.push({
          batchIndex,
          success: false,
          processedContracts: 0,
          retryCount: 0,
          processingTime,
          error: error instanceof Error ? error.message : String(error),
        });

        failedBatches++;
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    this.logger.log(
      `Batch processing completed for ${blockchain.name}: ${successfulBatches}/${batches.length} batches successful, ${processedContracts} contracts processed`,
    );

    return {
      totalBatches: batches.length,
      successfulBatches,
      failedBatches,
      totalContracts: selectedContracts.length,
      processedContracts,
      results,
      startTime,
      endTime,
      totalDuration,
      errors,
    };
  }
}
