import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blockchain } from './entities/blockchain.entity';
import { Bytecode } from '../contracts/entities/bytecode.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { calculateActualBid } from '../data-processing/utils/bid-utils';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainsService {
  constructor(
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    @InjectRepository(Bytecode)
    private bytecodeRepository: Repository<Bytecode>,
    @InjectRepository(BlockchainState)
    private blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(BlockchainEvent)
    private blockchainEventRepository: Repository<BlockchainEvent>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const blockchainsConfig = this.configService.get(
      'blockchains',
    ) as Blockchain[];

    if (!blockchainsConfig || !Array.isArray(blockchainsConfig)) {
      return [];
    }

    for (const blockchain of blockchainsConfig) {
      const existingBlockchain = await this.blockchainRepository.findOne({
        where: { chainId: blockchain.chainId, rpcUrl: blockchain.rpcUrl },
      });

      if (!existingBlockchain) {
        await this.blockchainRepository.insert(blockchain);
      }
    }
  }

  findAll() {
    return this.blockchainRepository.find(); // TODO Add interceptor to only share the necessary data
  }

  async getBlockchainData(blockchainId: string) {
    // Bytecode Data
    const netBytecodesTrends = await this.getNetBytecodesTrends(
      'M',
      blockchainId,
    );
    const bytecodeCount = await this.bytecodeRepository.count({
      where: { blockchain: { id: blockchainId }, isCached: true },
    });
    const bytecodeCountDiffWithLastPeriod =
      netBytecodesTrends[netBytecodesTrends.length - 1].currentTotal -
      netBytecodesTrends[netBytecodesTrends.length - 2].currentTotal;

    // Get queue size from blockchain state
    const blockchainState = await this.blockchainStateRepository.findOne({
      where: { blockchain: { id: blockchainId } },
      order: { blockNumber: 'DESC' },
    });

    if (!blockchainState) {
      throw new Error('Blockchain state not found');
    }

    const { queueSize, cacheSize } = blockchainState;

    const bidPlacementTrends = await this.getBidPlacementTrends(
      'D',
      blockchainId,
    );
    const bidPlacementTrendsWeek = await this.getBidPlacementTrends(
      'W',
      blockchainId,
    );
    const bidPlacementTrendsMonth = await this.getBidPlacementTrends(
      'M',
      blockchainId,
    );
    const bidPlacementTrendsYear = await this.getBidPlacementTrends(
      'Y',
      blockchainId,
    );

    // Get average bids for different size ranges
    const averageBidAll = await this.getAverageBid('D', blockchainId, 0); // All sizes
    const averageBidSmall = await this.getAverageBid('D', blockchainId, 800, 0); // 0-800KB
    const averageBidMedium = await this.getAverageBid(
      'D',
      blockchainId,
      1600,
      800,
    ); // 800-1600KB
    const averageBidLarge = await this.getAverageBid(
      'D',
      blockchainId,
      0,
      1600,
    ); // >1600KB

    return {
      bytecodeCount,
      bytecodeCountDiffWithLastPeriod,
      queueSize,
      cacheSize,
      bidPlacementTrends,
      bidPlacementTrendsWeek,
      bidPlacementTrendsMonth,
      bidPlacementTrendsYear,
      netBytecodesTrends,
      averageBids: {
        all: averageBidAll,
        small: averageBidSmall, // 0-800KB
        medium: averageBidMedium, // 800-1600KB
        large: averageBidLarge, // >1600KB
      },
    };
  }

  async getTotalBytecodes(blockchainId: string) {
    // Bytecode Data
    const netBytecodesTrends = await this.getNetBytecodesTrends(
      'M',
      blockchainId,
    );
    const bytecodeCount = await this.bytecodeRepository.count({
      where: { blockchain: { id: blockchainId }, isCached: true },
    });
    const bytecodeCountDiffWithLastMonth =
      netBytecodesTrends[netBytecodesTrends.length - 1].currentTotal -
      netBytecodesTrends[netBytecodesTrends.length - 2].currentTotal;

    return {
      bytecodeCount,
      bytecodeCountDiffWithLastMonth,
    };
  }

  async getCacheStats(blockchainId: string) {
    const blockchainState = await this.blockchainStateRepository.findOne({
      where: { blockchain: { id: blockchainId } },
      order: { blockNumber: 'DESC' },
    });

    if (!blockchainState) {
      throw new Error('Blockchain state not found');
    }

    const { queueSize, cacheSize } = blockchainState;

    const cacheFilledPercentage = (Number(queueSize) / Number(cacheSize)) * 100;

    const queueSizeMB = Number(queueSize) / 1000 / 1000;
    const cacheSizeMB = Number(cacheSize) / 1000 / 1000;

    return {
      queueSize,
      cacheSize,
      queueSizeMB,
      cacheSizeMB,
      cacheFilledPercentage,
    };
  }

  async getBidPlacementTrends(timespan: string, blockchainId: string) {
    // Will filter insertBid events and group them by different timespans D, W, M, Y

    const timespans = ['D', 'W', 'M', 'Y']; // TODO Add to Validator instead of here.
    if (!timespans.includes(timespan)) {
      throw new Error('Invalid timespan');
    }

    // N times the timespan to have several bars in the chart
    const backTraceTimestamp = getBackTraceTimestamp(timespan, 12);
    // Define the date format based on timespan
    const dateFormat = getDateFormat(timespan);

    // Use query builder to group by date format
    let queryBuilder = this.blockchainEventRepository
      .createQueryBuilder('event')
      .select(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
      .addSelect('COUNT(*)', 'count')
      .where('event.eventName = :eventName', { eventName: 'InsertBid' })
      .andWhere('event.blockTimestamp >= :timestamp', {
        timestamp: backTraceTimestamp,
      })
      .innerJoin('event.blockchain', 'blockchain')
      .andWhere('blockchain.id = :blockchainId', {
        blockchainId,
      });

    const result = await queryBuilder
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      period: item.period,
      count: parseInt(item.count, 10),
    }));
  }

  async getNetBytecodesTrends(timespan: string, blockchainId: string) {
    const timespans = ['D', 'W', 'M', 'Y'];
    if (!timespans.includes(timespan)) {
      throw new Error('Invalid timespan');
    }

    // N times the timespan to have several bars in the chart
    const backTraceTimestamp = getBackTraceTimestamp(timespan, 2);
    // Define the date format based on timespan
    const dateFormat = getDateFormat(timespan);

    // Get all relevant events
    let queryBuilder = this.blockchainEventRepository
      .createQueryBuilder('event')
      .select(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
      .addSelect('event.eventName', 'eventName')
      .addSelect('COUNT(*)', 'count')
      .where('event.eventName IN (:...eventNames)', {
        eventNames: ['InsertBid', 'DeleteBid'],
      })
      .andWhere('event.blockTimestamp >= :timestamp', {
        timestamp: backTraceTimestamp,
      })
      .innerJoin('event.blockchain', 'blockchain')
      .andWhere('blockchain.id = :blockchainId', {
        blockchainId,
      });

    const events = await queryBuilder
      .groupBy(
        `to_char(event.blockTimestamp, '${dateFormat}'), event.eventName`,
      )
      .orderBy('period', 'ASC')
      .getRawMany();

    // Process the results to calculate net changes per period
    const periodMap = new Map();

    // Initialize with all periods
    const uniquePeriods = [...new Set(events.map((e) => e.period))].sort();
    uniquePeriods.forEach((period) => {
      periodMap.set(period, { insertCount: 0, deleteCount: 0 });
    });

    // Fill in the actual counts
    events.forEach((event) => {
      const periodData = periodMap.get(event.period);
      if (event.eventName === 'InsertBid') {
        periodData.insertCount = parseInt(event.count, 10);
      } else if (event.eventName === 'DeleteBid') {
        periodData.deleteCount = parseInt(event.count, 10);
      }
    });

    // Calculate net change and running total
    let runningTotal = 0;
    const result: Array<{
      period: string;
      insertCount: number;
      deleteCount: number;
      netChange: number;
      currentTotal: number;
    }> = [];

    uniquePeriods.forEach((period) => {
      const { insertCount, deleteCount } = periodMap.get(period);
      const netChange = insertCount - deleteCount;
      runningTotal += netChange;

      result.push({
        period,
        insertCount,
        deleteCount,
        netChange,
        currentTotal: runningTotal,
      });
    });

    return result;
  }

  async getAverageBid(
    timespan: string,
    blockchainId: string,
    maxSizeKB: number = 0,
    minSizeKB: number = 0,
  ) {
    // Will filter insertBid events and group them by different timespans D, W, M, Y
    const timespans = ['D', 'W', 'M', 'Y'];
    if (!timespans.includes(timespan)) {
      throw new Error('Invalid timespan');
    }

    const backTraceTimestamp = getBackTraceTimestamp(timespan, 12);
    const dateFormat = getDateFormat(timespan);

    // Create base query conditions
    const baseConditions = {
      eventName: 'InsertBid',
      timestamp: backTraceTimestamp,
    };

    // Create size conditions if needed
    // If both are 0, no size condition, bring all.

    let sizeCondition = '';
    const sizeParams: Record<string, number> = {};

    if (maxSizeKB > 0 && minSizeKB > 0) {
      // Between minSize and maxSize
      sizeCondition =
        'CAST(event."eventData"->>3 AS DECIMAL) >= :minSize AND CAST(event."eventData"->>3 AS DECIMAL) <= :maxSize';
      sizeParams.minSize = minSizeKB * 1024; // Convert KB to bytes
      sizeParams.maxSize = maxSizeKB * 1024; // Convert KB to bytes
    } else if (maxSizeKB > 0) {
      // Up to maxSize
      sizeCondition = 'CAST(event."eventData"->>3 AS DECIMAL) <= :maxSize';
      sizeParams.maxSize = maxSizeKB * 1024; // Convert KB to bytes
    } else if (minSizeKB > 0) {
      // Greater than or equal to minSize
      sizeCondition = 'CAST(event."eventData"->>3 AS DECIMAL) >= :minSize';
      sizeParams.minSize = minSizeKB * 1024; // Convert KB to bytes
    }

    // Get the most recent blockchain state to use as fallback for decay rate
    const whereClause = { blockchain: { id: blockchainId } };

    const latestBlockchainState = await this.blockchainStateRepository.findOne({
      where: whereClause,
      order: { blockNumber: 'DESC' },
    });

    // Default decay rate from the latest blockchain state or '0' if not available
    const defaultDecayRate = latestBlockchainState?.decayRate ?? '0';

    // Fetch all SetDecayRate events first
    const eventWhereClause: any = {
      eventName: 'SetDecayRate',
    };

    if (blockchainId) {
      eventWhereClause.blockchain = { id: blockchainId };
    }

    const decayRateEvents = await this.blockchainEventRepository.find({
      where: eventWhereClause,
      order: {
        blockNumber: 'ASC',
        logIndex: 'ASC',
      },
    });

    // Fetch all InsertBid events
    let eventsQueryBuilder = this.blockchainEventRepository
      .createQueryBuilder('event')
      .select('event.id', 'id')
      .addSelect('event.blockNumber', 'blockNumber')
      .addSelect('event.blockTimestamp', 'blockTimestamp')
      .addSelect('event."eventData"', 'eventData')
      .addSelect(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
      .where('event.eventName = :eventName', {
        eventName: baseConditions.eventName,
      })
      .andWhere('event.blockTimestamp >= :timestamp', {
        timestamp: baseConditions.timestamp,
      })
      .innerJoin('event.blockchain', 'blockchain')
      .andWhere('blockchain.id = :blockchainId', {
        blockchainId,
      });

    // Add size filter if needed
    if (sizeCondition) {
      eventsQueryBuilder = eventsQueryBuilder.andWhere(
        sizeCondition,
        sizeParams,
      );
    }

    const insertBidEvents = await eventsQueryBuilder.getRawMany();

    // Group events by period for later averaging
    const periodBids = new Map<string, { sum: bigint; count: number }>();
    let globalSum = BigInt(0);
    let globalCount = 0;

    // Process each InsertBid event
    for (const event of insertBidEvents) {
      const eventData = event.eventData;
      const period = event.period;
      const bidValue = eventData[2];
      const blockTimestamp = new Date(event.blockTimestamp);
      const blockNumber = event.blockNumber;

      // Find the most recent decay rate event for this InsertBid
      let applicableDecayRate = defaultDecayRate;

      // Search for the applicable decay rate by finding the most recent
      // decay rate event that occurred before this InsertBid event
      for (let i = 0; i < decayRateEvents.length; i++) {
        const decayEvent = decayRateEvents[i];

        // If this decay event is after our InsertBid, stop looking
        if (
          decayEvent.blockNumber > blockNumber ||
          (decayEvent.blockNumber === blockNumber &&
            decayEvent.logIndex >= event.logIndex)
        ) {
          break;
        }

        // Otherwise, this is a valid decay rate to use
        applicableDecayRate = decayEvent.eventData[0];
      }

      // Calculate the actual bid with the decay applied
      const actualBid = calculateActualBid(
        bidValue,
        applicableDecayRate,
        blockTimestamp,
      );

      // Keep as BigInt to maintain integer precision
      const actualBidValue = BigInt(actualBid);

      // Add to the period's sum and count
      if (!periodBids.has(period)) {
        periodBids.set(period, { sum: BigInt(0), count: 0 });
      }
      const periodData = periodBids.get(period);
      if (periodData) {
        periodData.sum += actualBidValue;
        periodData.count += 1;
      }

      // Add to global sum and count
      globalSum = typeof globalSum === 'bigint' ? globalSum : BigInt(0);
      globalSum += actualBidValue;
      globalCount += 1;
    }

    // Calculate averages for each period
    const periodResults = Array.from(periodBids.entries())
      .map(([period, data]) => {
        let averageBid = BigInt(0);
        if (data.count > 0) {
          // Integer division with BigInt
          averageBid = data.sum / BigInt(data.count);
        }
        return {
          period,
          averageBid: averageBid.toString(), // Convert to string to preserve full integer value
          parsedAverageBid: ethers.formatEther(averageBid), // Add parsed value in ETH
          count: data.count,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    // Calculate global average
    let globalAverage = BigInt(0);
    if (globalCount > 0) {
      globalAverage = globalSum / BigInt(globalCount);
    }

    return {
      periods: periodResults,
      global: {
        averageBid: globalAverage.toString(), // Convert to string to preserve full integer value
        parsedAverageBid: ethers.formatEther(globalAverage), // Add parsed value in ETH
        count: globalCount,
      },
    };
  }
}

// Add this helper function to convert timespan string to milliseconds
function getTimespanInMs(timespan: string): number {
  switch (timespan) {
    case 'D':
      return 24 * 60 * 60 * 1000; // 1 day in ms
    case 'W':
      return 7 * 24 * 60 * 60 * 1000; // 1 week in ms
    case 'M':
      return 30 * 24 * 60 * 60 * 1000; // ~1 month in ms
    case 'Y':
      return 365 * 24 * 60 * 60 * 1000; // ~1 year in ms
    default:
      throw new Error('Invalid timespan');
  }
}

function getBackTraceTimestamp(
  timespan: string,
  numberOfBackTimespans: number,
): Date {
  return new Date(
    Date.now() - getTimespanInMs(timespan) * numberOfBackTimespans,
  );
}

function getDateFormat(timespan: string): string {
  // Define the date format based on timespan
  let dateFormat: string;
  switch (timespan) {
    case 'D':
      dateFormat = 'YYYY-MM-DD';
      break;
    case 'W':
      dateFormat = 'YYYY-WW'; // ISO week
      break;
    case 'M':
      dateFormat = 'YYYY-MM';
      break;
    case 'Y':
      dateFormat = 'YYYY';
      break;
    default:
      throw new Error('Invalid timespan');
  }
  return dateFormat;
}
