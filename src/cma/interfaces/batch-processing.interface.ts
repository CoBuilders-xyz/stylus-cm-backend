export interface BatchContract {
  user: string;
  address: string;
}

export interface BatchProcessingConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  processingTimeout: number;
  parallelBatches?: number;
}

export interface BatchInfo {
  index: number;
  total: number;
  contracts: BatchContract[];
  size: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface BatchResult {
  batchIndex: number;
  success: boolean;
  processedContracts: number;
  retryCount: number;
  processingTime: number;
  queueId?: string;
  transactionHash?: string;
  error?: string;
}

export interface BatchProcessingResult {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalContracts: number;
  processedContracts: number;
  results: BatchResult[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  errors: string[];
}

export interface BatchProcessingOptions {
  config: BatchProcessingConfig;
  skipFailedBatches?: boolean;
  logProgress?: boolean;
  includeDetails?: boolean;
}

export interface BatchProcessingStats {
  averageProcessingTime: number;
  successRate: number;
  throughput: number; // contracts per second
  errorRate: number;
  retryRate: number;
}

export interface BatchQueueItem {
  batch: BatchContract[];
  batchIndex: number;
  retryCount: number;
  priority: number;
  createdAt: Date;
  scheduledAt?: Date;
}
