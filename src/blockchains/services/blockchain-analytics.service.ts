import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { BlockchainState } from '../entities/blockchain-state.entity';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { BlockchainCrudService } from './blockchain-crud.service';
import {
  BlockchainEventName,
  getDateFormat,
  getBackTraceTimestamp,
  TREND_PERIODS,
  UNIT_CONVERSIONS,
} from '../constants';
import { BidTrendsDto, BidAverageDto } from '../dto';
import { calculateActualBid } from '../../data-processing/utils/bid-utils';
import { ethers } from 'ethers';

// Type definitions for query results
interface BidPlacementQueryResult {
  period: string;
  count: string;
}

interface NetBytecodeQueryResult {
  period: string;
  eventName: string;
  count: string;
}

interface AverageBidQueryResult {
  id: string;
  blockNumber: number;
  blockTimestamp: string;
  eventData: any[];
  period: string;
  logIndex?: number;
}

interface PeriodData {
  insertCount: number;
  deleteCount: number;
}

@Injectable()
export class BlockchainAnalyticsService {
  private readonly logger = new Logger(BlockchainAnalyticsService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(BlockchainState)
    private readonly blockchainStateRepository: Repository<BlockchainState>,
    @InjectRepository(Bytecode)
    private readonly bytecodeRepository: Repository<Bytecode>,
    private readonly blockchainCrudService: BlockchainCrudService,
  ) {}

  /**
   * Get bid placement trends for a specific timespan
   */
  async getBidPlacementTrends(dto: BidTrendsDto) {
    try {
      this.logger.log(
        `Getting bid placement trends for blockchain: ${dto.blockchainId}, timespan: ${dto.timespan}`,
      );

      // Validate blockchain exists
      await this.blockchainCrudService.validateBlockchainExists(
        dto.blockchainId,
      );

      const backTraceTimestamp = getBackTraceTimestamp(
        dto.timespan,
        TREND_PERIODS.DEFAULT,
      );
      const dateFormat = getDateFormat(dto.timespan);

      const queryBuilder = this.blockchainEventRepository
        .createQueryBuilder('event')
        .select(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
        .addSelect('COUNT(*)', 'count')
        .where('event.eventName = :eventName', {
          eventName: BlockchainEventName.INSERT_BID,
        })
        .andWhere('event.blockTimestamp >= :timestamp', {
          timestamp: backTraceTimestamp,
        })
        .innerJoin('event.blockchain', 'blockchain')
        .andWhere('blockchain.id = :blockchainId', {
          blockchainId: dto.blockchainId,
        });

      const result = await queryBuilder
        .groupBy('period')
        .orderBy('period', 'ASC')
        .getRawMany<BidPlacementQueryResult>();

      const response = {
        periods: result.map((item) => ({
          period: item.period,
          count: parseInt(item.count, 10),
        })),
        global: {
          count: result.reduce(
            (acc, item) => acc + parseInt(item.count, 10),
            0,
          ),
        },
      };

      this.logger.log(
        `Bid placement trends calculated for blockchain: ${dto.blockchainId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error getting bid placement trends for blockchain: ${dto.blockchainId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get net bytecodes trends (difference between insert and delete bids)
   */
  async getNetBytecodesTrends(dto: BidTrendsDto) {
    try {
      this.logger.log(
        `Getting net bytecodes trends for blockchain: ${dto.blockchainId}, timespan: ${dto.timespan}`,
      );

      // Validate blockchain exists
      await this.blockchainCrudService.validateBlockchainExists(
        dto.blockchainId,
      );

      const backTraceTimestamp = getBackTraceTimestamp(
        dto.timespan,
        TREND_PERIODS.BYTECODE_TRENDS,
      );
      const dateFormat = getDateFormat(dto.timespan);

      const queryBuilder = this.blockchainEventRepository
        .createQueryBuilder('event')
        .select(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
        .addSelect('event.eventName', 'eventName')
        .addSelect('COUNT(*)', 'count')
        .where('event.eventName IN (:...eventNames)', {
          eventNames: [
            BlockchainEventName.INSERT_BID,
            BlockchainEventName.DELETE_BID,
          ],
        })
        .andWhere('event.blockTimestamp >= :timestamp', {
          timestamp: backTraceTimestamp,
        })
        .innerJoin('event.blockchain', 'blockchain')
        .andWhere('blockchain.id = :blockchainId', {
          blockchainId: dto.blockchainId,
        });

      const events = await queryBuilder
        .groupBy(
          `to_char(event.blockTimestamp, '${dateFormat}'), event.eventName`,
        )
        .orderBy('period', 'ASC')
        .getRawMany<NetBytecodeQueryResult>();

      // Process the results to calculate net changes per period
      const periodMap = new Map<string, PeriodData>();
      const uniquePeriods = [...new Set(events.map((e) => e.period))].sort();

      uniquePeriods.forEach((period) => {
        periodMap.set(period, { insertCount: 0, deleteCount: 0 });
      });

      events.forEach((event) => {
        const periodData = periodMap.get(event.period);
        if (periodData) {
          if (
            (event.eventName as BlockchainEventName) ===
            BlockchainEventName.INSERT_BID
          ) {
            periodData.insertCount = parseInt(event.count, 10);
          } else if (
            (event.eventName as BlockchainEventName) ===
            BlockchainEventName.DELETE_BID
          ) {
            periodData.deleteCount = parseInt(event.count, 10);
          }
        }
      });

      let runningTotal = 0;
      const results = Array.from(periodMap.entries()).map(([period, data]) => {
        const netChange = data.insertCount - data.deleteCount;
        runningTotal += netChange;
        return {
          period,
          insertCount: data.insertCount,
          deleteCount: data.deleteCount,
          netChange,
          currentTotal: runningTotal,
        };
      });

      this.logger.log(
        `Net bytecodes trends calculated for blockchain: ${dto.blockchainId}`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Error getting net bytecodes trends for blockchain: ${dto.blockchainId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get average bid with optional size filtering
   */
  async getAverageBid(dto: BidAverageDto) {
    try {
      this.logger.log(
        `Getting average bid for blockchain: ${dto.blockchainId}, timespan: ${dto.timespan}`,
      );

      // Validate blockchain exists
      await this.blockchainCrudService.validateBlockchainExists(
        dto.blockchainId,
      );

      const backTraceTimestamp = getBackTraceTimestamp(
        dto.timespan,
        TREND_PERIODS.DEFAULT,
      );
      const dateFormat = getDateFormat(dto.timespan);

      // Create size condition if needed
      let sizeCondition = '';
      const sizeParams: Record<string, number> = {};

      if (dto.maxSize && dto.minSize) {
        sizeCondition =
          'CAST(event."eventData"->>3 AS DECIMAL) >= :minSize AND CAST(event."eventData"->>3 AS DECIMAL) <= :maxSize';
        sizeParams.minSize = dto.minSize * UNIT_CONVERSIONS.KB_TO_BYTES;
        sizeParams.maxSize = dto.maxSize * UNIT_CONVERSIONS.KB_TO_BYTES;
      } else if (dto.maxSize) {
        sizeCondition = 'CAST(event."eventData"->>3 AS DECIMAL) <= :maxSize';
        sizeParams.maxSize = dto.maxSize * UNIT_CONVERSIONS.KB_TO_BYTES;
      } else if (dto.minSize) {
        sizeCondition = 'CAST(event."eventData"->>3 AS DECIMAL) >= :minSize';
        sizeParams.minSize = dto.minSize * UNIT_CONVERSIONS.KB_TO_BYTES;
      }

      // Get latest blockchain state for fallback decay rate
      const latestBlockchainState =
        await this.blockchainStateRepository.findOne({
          where: { blockchain: { id: dto.blockchainId } },
          order: { blockNumber: 'DESC' },
        });

      const defaultDecayRate = latestBlockchainState?.decayRate ?? '0';

      // Fetch decay rate events
      const decayRateEvents = await this.blockchainEventRepository.find({
        where: {
          eventName: BlockchainEventName.SET_DECAY_RATE,
          blockchain: { id: dto.blockchainId },
        },
        order: {
          blockNumber: 'ASC',
          logIndex: 'ASC',
        },
      });

      // Build query for InsertBid events
      let eventsQueryBuilder = this.blockchainEventRepository
        .createQueryBuilder('event')
        .select('event.id', 'id')
        .addSelect('event.blockNumber', 'blockNumber')
        .addSelect('event.blockTimestamp', 'blockTimestamp')
        .addSelect('event."eventData"', 'eventData')
        .addSelect('event.logIndex', 'logIndex')
        .addSelect(`to_char(event.blockTimestamp, '${dateFormat}')`, 'period')
        .where('event.eventName = :eventName', {
          eventName: BlockchainEventName.INSERT_BID,
        })
        .andWhere('event.blockTimestamp >= :timestamp', {
          timestamp: backTraceTimestamp,
        })
        .innerJoin('event.blockchain', 'blockchain')
        .andWhere('blockchain.id = :blockchainId', {
          blockchainId: dto.blockchainId,
        });

      // Add size filter if needed
      if (sizeCondition) {
        eventsQueryBuilder = eventsQueryBuilder.andWhere(
          sizeCondition,
          sizeParams,
        );
      }

      const insertBidEvents =
        await eventsQueryBuilder.getRawMany<AverageBidQueryResult>();

      // Process events to calculate averages
      const periodBids = new Map<string, { sum: bigint; count: number }>();
      let globalSum = BigInt(0);
      let globalCount = 0;

      for (const event of insertBidEvents) {
        const eventData = event.eventData;
        const period = event.period;
        const bidValue = eventData[2] as string;
        const blockTimestamp = new Date(event.blockTimestamp);
        const blockNumber = event.blockNumber;

        // Find applicable decay rate
        let applicableDecayRate = defaultDecayRate;
        for (const decayEvent of decayRateEvents) {
          if (
            decayEvent.blockNumber > blockNumber ||
            (decayEvent.blockNumber === blockNumber &&
              decayEvent.logIndex >= (event.logIndex ?? 0))
          ) {
            break;
          }
          applicableDecayRate = decayEvent.eventData[0] as string;
        }

        const actualBid = calculateActualBid(
          bidValue,
          applicableDecayRate,
          blockTimestamp,
        );
        const actualBidValue = BigInt(actualBid);

        // Add to period's sum and count
        if (!periodBids.has(period)) {
          periodBids.set(period, { sum: BigInt(0), count: 0 });
        }
        const periodData = periodBids.get(period)!;
        periodData.sum += actualBidValue;
        periodData.count += 1;

        globalSum += actualBidValue;
        globalCount += 1;
      }

      // Calculate averages for each period
      const periodResults = Array.from(periodBids.entries())
        .map(([period, data]) => {
          let averageBid = BigInt(0);
          if (data.count > 0) {
            averageBid = data.sum / BigInt(data.count);
          }
          return {
            period,
            averageBid: averageBid.toString(),
            parsedAverageBid: ethers.formatEther(averageBid),
            count: data.count,
          };
        })
        .sort((a, b) => a.period.localeCompare(b.period));

      // Calculate global average
      let globalAverage = BigInt(0);
      if (globalCount > 0) {
        globalAverage = globalSum / BigInt(globalCount);
      }

      const response = {
        periods: periodResults,
        global: {
          averageBid: globalAverage.toString(),
          parsedAverageBid: ethers.formatEther(globalAverage),
          count: globalCount,
        },
      };

      this.logger.log(
        `Average bid calculated for blockchain: ${dto.blockchainId}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error getting average bid for blockchain: ${dto.blockchainId}`,
        error,
      );
      throw error;
    }
  }
}
