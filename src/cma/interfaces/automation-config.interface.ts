import { Blockchain } from 'src/blockchains/entities/blockchain.entity';

export interface AutomationConfig {
  enabled: boolean;
  batchSize: number;
  paginationLimit: number;
  maxRetries: number;
  retryDelay: number;
  processingTimeout: number;
}

export interface AutomationContext {
  blockchain: Blockchain;
  config: AutomationConfig;
  startTime: Date;
  batchIndex?: number;
  totalBatches?: number;
}

export interface AutomationStats {
  totalBlockchains: number;
  processedBlockchains: number;
  totalContracts: number;
  processedContracts: number;
  successfulBatches: number;
  failedBatches: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface AutomationResult {
  success: boolean;
  stats: AutomationStats;
  errors: Array<{
    blockchain: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface CronJobConfig {
  expression: string;
  enabled: boolean;
  timezone?: string;
  description?: string;
}

export interface AutomationSchedule {
  cron: CronJobConfig;
  isRunning: boolean;
  runCount: number;
  lastRun?: Date;
  nextRun?: Date;
}
