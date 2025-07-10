/**
 * Risk multiplier constants for bid calculations
 * These values determine the risk levels for contract bidding strategies
 */
export const RISK_MULTIPLIERS = {
  /**
   * High risk multiplier - minimum viable bid
   * Contracts with this multiplier have higher eviction risk
   */
  BASE_HIGH_RISK: 1.0,

  /**
   * Medium risk multiplier - better chance of staying cached
   * Balanced approach between cost and cache retention
   */
  BASE_MID_RISK: 1.5,

  /**
   * Low risk multiplier - very likely to stay cached
   * Higher cost but maximum cache retention probability
   */
  BASE_LOW_RISK: 2.5,
} as const;

/**
 * Cache analysis configuration constants
 */
export const CACHE_ANALYSIS = {
  /**
   * Number of days to analyze for cache statistics and eviction patterns
   */
  ANALYSIS_PERIOD_DAYS: 7,
} as const;
