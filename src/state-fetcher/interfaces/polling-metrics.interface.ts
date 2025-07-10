export interface PollingMetrics {
  blockchainId: string;
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  averagePollingTime: number;
  lastPollingTime: Date | null;
  lastSuccessfulPoll: Date | null;
  lastFailedPoll: Date | null;
  successRate: number;
}

export interface PollingSession {
  blockchainId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  dataPoints: number;
}
