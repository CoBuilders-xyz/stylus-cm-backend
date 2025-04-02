import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Blockchain } from './entities/blockchain.entity';
import { Bytecode } from '../contracts/entities/bytecode.entity';
import { BlockchainState } from './entities/blockchain-state.entity';
import { BlockchainEvent } from './entities/blockchain-event.entity';

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

  async getBlockchainData(id: string) {
    // count bytecodes cached
    const bytecodeCount = await this.bytecodeRepository.count({
      where: { blockchain: { id }, isCached: true },
    });

    // Get queue size from blockchain state
    const blockchainState = await this.blockchainStateRepository.findOne({
      where: { blockchain: { id } },
      order: { blockNumber: 'DESC' },
    });

    if (!blockchainState) {
      throw new Error('Blockchain state not found');
    }

    const { queueSize, cacheSize } = blockchainState;

    const bidPlacementTrends = await this.getBidPlacementTrends('D');
    const bidPlacementTrendsWeek = await this.getBidPlacementTrends('W');
    const bidPlacementTrendsMonth = await this.getBidPlacementTrends('M');
    const bidPlacementTrendsYear = await this.getBidPlacementTrends('Y');

    const netBytecodesTrends = await this.getNetBytecodesTrends('M');

    return {
      bytecodeCount,
      queueSize,
      cacheSize,
      bidPlacementTrends,
      bidPlacementTrendsWeek,
      bidPlacementTrendsMonth,
      bidPlacementTrendsYear,
      netBytecodesTrends,
    };
  }

  async getBidPlacementTrends(timespan: string) {
    // Will filter insertBid events and group them by different timespans D, W, M, Y

    const timespans = ['D', 'W', 'M', 'Y'];
    if (!timespans.includes(timespan)) {
      throw new Error('Invalid timespan');
    }

    // Ten times the timespan to have several bars in the chart
    const backTraceTimestamp = new Date(
      Date.now() - getTimespanInMs(timespan) * 10,
    );

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

    // Use query builder to group by date format
    const result = await this.blockchainEventRepository
      .createQueryBuilder('event')
      .select(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
      .addSelect('COUNT(*)', 'count')
      .where('event.eventName = :eventName', { eventName: 'InsertBid' })
      .andWhere('event.blockTimestamp >= :timestamp', {
        timestamp: backTraceTimestamp,
      })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      period: item.period,
      count: parseInt(item.count, 10),
    }));
  }

  async getNetBytecodesTrends(timespan: string) {
    const timespans = ['D', 'W', 'M', 'Y'];
    if (!timespans.includes(timespan)) {
      throw new Error('Invalid timespan');
    }

    // Ten times the timespan to have several bars in the chart
    const backTraceTimestamp = new Date(
      Date.now() - getTimespanInMs(timespan) * 2,
    );

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

    // Get all relevant events
    const events = await this.blockchainEventRepository
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
