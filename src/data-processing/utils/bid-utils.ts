import { ethers } from 'ethers';

/**
 * Calculates the actual bid value by subtracting the decay amount from the raw bid.
 *
 * @param bidValue The raw bid value as a string (in wei)
 * @param decayRate The decay rate as a string (in wei per second)
 * @param blockTimestamp The timestamp of the block when the bid was made
 * @returns The actual bid amount in ETH
 */
export function calculateActualBid(
  bidValue: string,
  decayRate: string,
  blockTimestamp: Date,
): string {
  try {
    const bidInWei = BigInt(bidValue);
    const decayRateInWei = BigInt(decayRate);
    const timestampInSeconds = Math.floor(blockTimestamp.getTime() / 1000);
    const decayAmount = BigInt(timestampInSeconds) * decayRateInWei;

    // Make sure bid is at least decayAmount to avoid underflow
    const actualBidInWei =
      bidInWei > decayAmount ? bidInWei - decayAmount : BigInt(0);

    // Convert to ETH
    return actualBidInWei.toString();
  } catch (error) {
    // If there's an error, log it and use the original value
    console.warn(`Error calculating actual bid value: ${error}`);
    return bidValue;
  }
}

/**
 * Calculates the bid plus decay value (the original bid including the decay amount).
 *
 * @param bidValue The raw bid value as a string (in wei)
 * @returns The bid plus decay amount in ETH
 */
export function calculateBidPlusDecay(bidValue: string): number {
  try {
    return parseFloat(ethers.formatEther(bidValue));
  } catch (error) {
    console.warn(`Error formatting bid value: ${error}`);
    return 0;
  }
}

/**
 * Updates the total bid investment based on event type.
 *
 * @param currentTotal The current total bid investment
 * @param bid The bid amount
 * @param isNewBid Whether this is a new bid after a DeleteBid or no previous bid
 * @returns The updated total bid investment
 */
export function updateTotalBidInvestment(
  currentTotal: string,
  bid: string,
): string {
  const currentInWei = BigInt(currentTotal);
  const bidInWei = BigInt(bid);
  return (currentInWei + bidInWei).toString();
}
