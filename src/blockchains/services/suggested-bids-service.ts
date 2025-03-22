import { Injectable } from '@nestjs/common';

@Injectable()
export class SuggestedBidsService {
  constructor() {}

  async getSuggestedBids(
    size: number,
    cacheManagerContract: any,
    provider: any,
  ) {
    // Step 1: Fetch minBid from contract
    const minBid = await cacheManagerContract['getMinBid(uint64)'](size);

    // Step 2: Fetch decay rate
    const decayRate = await cacheManagerContract.decay();
    const decayRateNum = Number(decayRate);

    // Step 3: Fetch historical bidding events
    const latestBlock = await provider.getBlockNumber();
    const startBlock = latestBlock - 5000; // Look back at recent blocks

    const placeBidEvents = await cacheManagerContract.queryFilter(
      cacheManagerContract.filters.InsertBid(),
      startBlock,
      latestBlock,
    );

    // Edge case: If no data, use minBid
    if (placeBidEvents.length === 0) {
      // Edge case: If no historical data, return minBid-based defaults
      const minBidNum = Number(minBid);
      return {
        highRisk: minBid,
        midRisk: BigInt(Math.floor(minBidNum * 1.2)), // 20% above minBid
        lowRisk: BigInt(Math.floor(minBidNum * 1.5)), // 50% above minBid
      };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const effectiveBids = placeBidEvents
      .map((event) => {
        const bid = event.args.bid as bigint;
        const eventSize = event.args.size as bigint;
        const bidBlock = event.blockNumber;

        return { bid, eventSize, bidBlock };
      })
      .filter(({ eventSize }) => eventSize > 0); // Ensure valid sizes

    // Fetch block timestamps for all bid blocks
    const blockTimestamps = new Map<number, number>();
    await Promise.all(
      effectiveBids.map(async ({ bidBlock }) => {
        if (!blockTimestamps.has(bidBlock)) {
          const block = await provider.getBlock(bidBlock);
          blockTimestamps.set(bidBlock, block.timestamp);
        }
      }),
    );

    // Compute final effective bids
    const adjustedBids = effectiveBids
      .map(({ bid, eventSize, bidBlock }) => {
        const bidPlacedTimestamp =
          blockTimestamps.get(bidBlock) || currentTimestamp;
        const timeSinceBid = currentTimestamp - bidPlacedTimestamp;
        const decayPenalty = BigInt(Math.floor(decayRateNum * timeSinceBid));

        const effectiveBid =
          bid > decayPenalty ? bid - decayPenalty : BigInt(0);
        const bidPerByte = effectiveBid / eventSize;

        return { effectiveBid, bidPerByte };
      })
      .sort((a, b) => Number(a.effectiveBid - b.effectiveBid)); // Sort by effective price (descending)

    // Step 5: Compute risk-based bids based on bidPerByte
    const bidPerByteValues = adjustedBids.map(({ bidPerByte }) => bidPerByte);

    const highRiskIndex = Math.floor(bidPerByteValues.length * 0.05);
    const midRiskIndex = Math.floor(bidPerByteValues.length * 0.25);
    const lowRiskIndex = Math.floor(bidPerByteValues.length * 0.5);

    const highRiskBidPerByte = bidPerByteValues[highRiskIndex];
    const midRiskBidPerByte = bidPerByteValues[midRiskIndex];
    const lowRiskBidPerByte = bidPerByteValues[lowRiskIndex];

    // Convert back to absolute bid values using the requested size
    const highRiskBid = minBid + highRiskBidPerByte * BigInt(size);
    const midRiskBid = minBid + midRiskBidPerByte * BigInt(size);
    const lowRiskBid = minBid + lowRiskBidPerByte * BigInt(size);

    return {
      highRisk: highRiskBid, // Might be evicted soon
      midRisk: midRiskBid, // Balanced
      lowRisk: lowRiskBid, // Very safe
    };
  }
}
