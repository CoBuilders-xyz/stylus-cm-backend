import { ethers } from 'ethers';
import { TIME_CONSTANTS } from '../constants/event-processing.constants';
import { DataProcessingErrorHelpers } from '../data-processing.errors';
import { createContextLogger } from '../../common/utils/logger.util';

const logger = createContextLogger('DataProcessing', 'BidUtils');

/**
 * Validates that a string represents a valid positive BigInt number
 */
function validatePositiveBigIntString(value: string): boolean {
  try {
    const bigIntValue = BigInt(value);
    return bigIntValue >= BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Calculates the actual bid value by subtracting the decay amount from the raw bid.
 *
 * @param bidValue The raw bid value as a string (in wei)
 * @param decayRate The decay rate as a string (in wei per second)
 * @param blockTimestamp The timestamp of the block when the bid was made
 * @returns The actual bid amount in wei as string
 */
export function calculateActualBid(
  bidValue: string,
  decayRate: string,
  blockTimestamp: Date,
): string {
  // Validate inputs before processing
  if (!validatePositiveBigIntString(bidValue)) {
    logger.error(`Invalid bid value: ${bidValue}`);
    DataProcessingErrorHelpers.throwBidCalculationFailed(bidValue, decayRate);
  }

  if (!validatePositiveBigIntString(decayRate)) {
    logger.error(`Invalid decay rate: ${decayRate}`);
    DataProcessingErrorHelpers.throwBidCalculationFailed(bidValue, decayRate);
  }

  try {
    const bidInWei = BigInt(bidValue);
    const decayRateInWei = BigInt(decayRate);
    const timestampInSeconds = Math.floor(
      blockTimestamp.getTime() / TIME_CONSTANTS.SECONDS_IN_MILLISECOND,
    );
    const decayAmount = BigInt(timestampInSeconds) * decayRateInWei;

    // Make sure bid is at least decayAmount to avoid underflow
    const actualBidInWei =
      bidInWei > decayAmount ? bidInWei - decayAmount : BigInt(0);

    // Return as string to maintain precision
    return actualBidInWei.toString();
  } catch (error) {
    logger.error(
      `Error calculating actual bid value: ${error}`,
      error instanceof Error ? error.stack : undefined,
    );
    // This function throws, so the function never returns
    DataProcessingErrorHelpers.throwBidCalculationFailed(bidValue, decayRate);
    // This line is unreachable but satisfies TypeScript
    throw new Error('Unreachable code');
  }
}

/**
 * Calculates the bid plus decay value (the original bid including the decay amount).
 *
 * @param bidValue The raw bid value as a string (in wei)
 * @returns The bid plus decay amount in ETH as number
 */
export function calculateBidPlusDecay(bidValue: string): number {
  // Validate input before processing
  if (!validatePositiveBigIntString(bidValue)) {
    logger.error(`Invalid bid value for formatting: ${bidValue}`);
    DataProcessingErrorHelpers.throwBidCalculationFailed(
      bidValue,
      'formatting',
    );
  }

  try {
    return parseFloat(ethers.formatEther(bidValue));
  } catch (error) {
    logger.error(
      `Error formatting bid value: ${error}`,
      error instanceof Error ? error.stack : undefined,
    );
    DataProcessingErrorHelpers.throwBidCalculationFailed(
      bidValue,
      'formatting',
    );
    // This line is unreachable but satisfies TypeScript
    throw new Error('Unreachable code');
  }
}

/**
 * Updates the total bid investment based on event type.
 *
 * @param currentTotal The current total bid investment as string
 * @param bid The bid amount as string
 * @returns The updated total bid investment as string
 */
export function updateTotalBidInvestment(
  currentTotal: string,
  bid: string,
): string {
  // Validate inputs before processing
  if (!validatePositiveBigIntString(currentTotal)) {
    logger.error(`Invalid current total: ${currentTotal}`);
    DataProcessingErrorHelpers.throwBidCalculationFailed(
      bid,
      'investment update',
    );
  }

  if (!validatePositiveBigIntString(bid)) {
    logger.error(`Invalid bid for investment update: ${bid}`);
    DataProcessingErrorHelpers.throwBidCalculationFailed(
      bid,
      'investment update',
    );
  }

  try {
    const currentInWei = BigInt(currentTotal);
    const bidInWei = BigInt(bid);
    return (currentInWei + bidInWei).toString();
  } catch (error) {
    logger.error(
      `Error updating total bid investment: ${error}`,
      error instanceof Error ? error.stack : undefined,
    );
    DataProcessingErrorHelpers.throwBidCalculationFailed(
      bid,
      'investment update',
    );
    // This line is unreachable but satisfies TypeScript
    throw new Error('Unreachable code');
  }
}
