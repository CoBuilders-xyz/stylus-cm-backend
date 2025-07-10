/**
 * Response interface for bid placement trends
 */
export interface BidTrendsResponse {
  periods: Array<{
    period: string;
    count: number;
  }>;
  global: {
    count: number;
  };
}

/**
 * Response interface for net bytecode trends
 */
export interface NetBytecodesTrendsResponse {
  period: string;
  insertCount: number;
  deleteCount: number;
  netChange: number;
  currentTotal: number;
}

/**
 * Response interface for average bid calculations
 */
export interface AverageBidResponse {
  periods: Array<{
    period: string;
    averageBid: string;
    parsedAverageBid: string;
    count: number;
  }>;
  global: {
    averageBid: string;
    parsedAverageBid: string;
    count: number;
  };
}

/**
 * Response interface for cache statistics
 */
export interface CacheStatsResponse {
  queueSize: string;
  cacheSize: string;
  queueSizeMB: number;
  cacheSizeMB: number;
  cacheFilledPercentage: number;
}

/**
 * Response interface for bytecode statistics
 */
export interface BytecodeStatsResponse {
  bytecodeCount: number;
  bytecodeCountDiffWithLastMonth: number;
}

/**
 * Response interface for bytecode statistics with trends
 */
export interface BytecodeStatsWithTrendsResponse {
  bytecodeCount: number;
  bytecodeCountDiffWithLastPeriod: number;
}

/**
 * Aggregate response interface for average bids by size ranges
 */
export interface AverageBidsResponse {
  all: AverageBidResponse;
  small: AverageBidResponse; // 0-800KB
  medium: AverageBidResponse; // 800-1600KB
  large: AverageBidResponse; // >1600KB
}

/**
 * Comprehensive response interface for blockchain dashboard data
 */
export interface BlockchainDataResponse {
  bytecodeCount: number;
  bytecodeCountDiffWithLastPeriod: number;
  queueSize: string;
  cacheSize: string;
  bidPlacementTrends: BidTrendsResponse;
  bidPlacementTrendsWeek: BidTrendsResponse;
  bidPlacementTrendsMonth: BidTrendsResponse;
  bidPlacementTrendsYear: BidTrendsResponse;
  netBytecodesTrends: NetBytecodesTrendsResponse[];
  averageBids: AverageBidsResponse;
}
