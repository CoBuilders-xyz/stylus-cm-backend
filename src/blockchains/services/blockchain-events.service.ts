import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { Blockchain } from '../entities/blockchain.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SearchDto } from '../../common/dto/search.dto';
import { PaginationResponse } from '../../common/interfaces/pagination-response.interface';
import { BlockchainEventsQueryDto, BlockchainEventType } from '../dto';
import { BlockchainEventResponse } from '../interfaces';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';

@Injectable()
export class BlockchainEventsService {
  private readonly logger = createModuleLogger(
    BlockchainEventsService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Blockchain)
    private readonly blockchainRepository: Repository<Blockchain>,
  ) {}

  /**
   * Find all blockchain events with pagination, filtering, and search
   */
  async findAll(
    queryDto: BlockchainEventsQueryDto,
    paginationDto: PaginationDto,
    searchDto: SearchDto,
  ): Promise<PaginationResponse<BlockchainEventResponse>> {
    try {
      this.logger.log(
        `Finding blockchain events with filters: ${JSON.stringify(queryDto)}`,
      );

      // Build the query
      const queryBuilder = this.blockchainEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.blockchain', 'blockchain')
        .where('event.eventName IN (:...eventNames)', {
          eventNames: [BlockchainEventType.INSERT, BlockchainEventType.DELETE],
        });

      // Apply blockchain filter if provided
      if (queryDto.blockchainId) {
        queryBuilder.andWhere('blockchain.id = :blockchainId', {
          blockchainId: queryDto.blockchainId,
        });
      }

      // Apply event type filter if provided
      if (queryDto.eventType) {
        queryBuilder.andWhere('event.eventName = :eventType', {
          eventType: queryDto.eventType,
        });
      }

      // Apply search filter if provided - Template for now
      if (searchDto.search) {
        // TODO: Implement search functionality
        // This is a template - implement based on requirements
        queryBuilder.andWhere(
          '(event.contractName ILIKE :search OR event.contractAddress ILIKE :search OR event.transactionHash ILIKE :search)',
          { search: `%${searchDto.search}%` },
        );
      }

      // Order by block timestamp and log index for consistent ordering
      queryBuilder.orderBy('event.blockTimestamp', 'DESC');
      queryBuilder.addOrderBy('event.logIndex', 'DESC');

      // Apply pagination
      const page = paginationDto.page || 1;
      const limit = paginationDto.limit || 10;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset);
      queryBuilder.take(limit);

      // Execute query
      const [events, totalItems] = await queryBuilder.getManyAndCount();

      // Transform to response format
      const data = events.map((event) => this.transformToResponse(event));

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      this.logger.log(
        `Successfully returned ${data.length} blockchain events (page ${page}/${totalPages})`,
      );

      return {
        data,
        meta: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find blockchain events: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Transform BlockchainEvent entity to response format
   */
  private transformToResponse(event: BlockchainEvent): BlockchainEventResponse {
    return {
      id: event.id,
      blockchainId: event.blockchain.id,
      blockchainName: event.blockchain.name,
      contractName: event.contractName,
      contractAddress: event.contractAddress,
      eventName: event.eventName,
      blockTimestamp: event.blockTimestamp,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      isRealTime: event.isRealTime,
      originAddress: event.originAddress,
      eventData: event.eventData,
    };
  }
}
