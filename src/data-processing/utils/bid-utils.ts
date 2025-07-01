import { ethers } from 'ethers';
import { Logger } from '@nestjs/common';
import { TIME_CONSTANTS } from '../constants/event-processing.constants';
import { DataProcessingErrorHelpers } from '../data-processing.errors';

const logger = new Logger('BidUtils');

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
  try {
    return parseFloat(ethers.formatEther(bidValue));
  } catch (error) {
    logger.error(
      `Error formatting bid value: ${error}`,
      error instanceof Error ? error.stack : undefined,
    );
    return 0;
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
  try {
    const currentInWei = BigInt(currentTotal);
    const bidInWei = BigInt(bid);
    return (currentInWei + bidInWei).toString();
  } catch (error) {
    logger.error(
      `Error updating total bid investment: ${error}`,
      error instanceof Error ? error.stack : undefined,
    );
    return currentTotal; // Return current total on error to avoid data corruption
  }
}
