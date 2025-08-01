import { AlertType, AlertStatus, AlertPriority } from '../constants';

/**
 * Base alert response interface
 */
export interface AlertResponse {
  id: string;
  type: AlertType;
  isActive: boolean;
  triggeredCount: number;
  createdAt: Date;
  updatedAt: Date;
  userContract: UserContractSummary;
  notificationChannels: NotificationChannelsResponse;
  value?: string;
  lastTriggered?: Date;
  lastNotified?: Date;
  lastQueued?: Date;
}

/**
 * User contract summary for alert responses
 */
export interface UserContractSummary {
  id: string;
  address: string;
  blockchain: BlockchainSummary;
  contract: ContractSummary;
}

/**
 * Blockchain summary for nested responses
 */
export interface BlockchainSummary {
  id: string;
  name: string;
  rpcUrl: string;
  enabled: boolean;
}

/**
 * Contract summary for nested responses
 */
export interface ContractSummary {
  id: string;
  name: string;
  bytecode: BytecodeSummary;
}

/**
 * Bytecode summary for nested responses
 */
export interface BytecodeSummary {
  id: string;
  bytecodeHash: string;
  size: number;
}

/**
 * Notification channels configuration
 */
export interface NotificationChannelsResponse {
  slackChannelEnabled: boolean;
  telegramChannelEnabled: boolean;
  webhookChannelEnabled: boolean;
}

/**
 * Alert statistics response
 */
export interface AlertStatsResponse {
  totalAlerts: number;
  activeAlerts: number;
  triggeredAlerts: number;
  alertsByType: Record<AlertType, number>;
  alertsByStatus: Record<AlertStatus, number>;
  alertsByPriority: Record<AlertPriority, number>;
}

/**
 * Alert creation/update response
 */
export interface AlertCreateUpdateResponse extends AlertResponse {
  operation: 'created' | 'updated';
  message: string;
}

/**
 * Paginated alerts response
 */
export interface PaginatedAlertsResponse {
  alerts: AlertResponse[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Alert monitoring status response
 */
export interface AlertMonitoringStatusResponse {
  systemStatus: 'active' | 'inactive' | 'maintenance';
  lastProcessedAt: Date;
  eventProcessingEnabled: boolean;
  realTimeMonitoringEnabled: boolean;
  queueStatus: QueueStatusResponse;
}

/**
 * Queue status for monitoring
 */
export interface QueueStatusResponse {
  name: string;
  activeJobs: number;
  waitingJobs: number;
  completedJobs: number;
  failedJobs: number;
  isHealthy: boolean;
}
