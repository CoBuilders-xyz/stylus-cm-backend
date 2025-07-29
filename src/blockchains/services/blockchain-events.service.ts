import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SearchDto } from '../../common/dto/search.dto';
import { PaginationResponse } from '../../common/interfaces/pagination-response.interface';
import {
  BlockchainEventsQueryDto,
  BlockchainEventType,
  BlockchainEventsSortingDto,
  BlockchainEventSortField,
} from '../dto';
import { BlockchainEventResponse } from '../interfaces';
import { createModuleLogger } from '../../common/utils/logger.util';
import { MODULE_NAME } from '../constants';
import { Contract } from '../../contracts/entities/contract.entity';

@Injectable()
export class BlockchainEventsService {
  private readonly logger = createModuleLogger(
    BlockchainEventsService,
    MODULE_NAME,
  );

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly blockchainEventRepository: Repository<BlockchainEvent>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  /**
   * Find all blockchain events with pagination, filtering, sorting, and search
   */
  async findAll(
    queryDto: BlockchainEventsQueryDto,
    paginationDto: PaginationDto,
    searchDto: SearchDto,
    sortingDto: BlockchainEventsSortingDto,
  ): Promise<PaginationResponse<BlockchainEventResponse>> {
    try {
      this.logger.log(
        `Finding blockchain events with filters: ${JSON.stringify(queryDto)}, search: ${searchDto.search}, sorting: ${JSON.stringify(sortingDto)}`,
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

      // Apply enhanced search filter if provided
      if (searchDto.search) {
        await this.applySearchFilter(
          queryBuilder,
          searchDto.search,
          queryDto.blockchainId,
        );
      }

      // Apply sorting
      this.applySorting(queryBuilder, sortingDto);

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
   * Apply search filter that looks up contracts by address and matches bytecode hashes
   */
  private async applySearchFilter(
    queryBuilder: SelectQueryBuilder<BlockchainEvent>,
    searchTerm: string,
    blockchainId: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Applying search filter for term: ${searchTerm}`);

      // Build contract search query
      const contractQueryBuilder = this.contractRepository
        .createQueryBuilder('contract')
        .leftJoinAndSelect('contract.bytecode', 'bytecode')
        .where('LOWER(contract.address) LIKE :searchTerm', {
          searchTerm: `%${searchTerm.toLowerCase()}%`,
        });

      contractQueryBuilder.andWhere('contract.blockchain.id = :blockchainId', {
        blockchainId,
      });

      // Execute contract search
      const matchingContracts = await contractQueryBuilder.getMany();

      this.logger.debug(
        `Found ${matchingContracts.length} contracts matching search term: ${searchTerm}`,
      );

      if (matchingContracts.length > 0) {
        // Extract bytecode hashes from matching contracts
        const bytecodeHashes = matchingContracts.map(
          (contract) => contract.bytecode.bytecodeHash,
        );

        this.logger.debug(
          `Searching for events with bytecode hashes: ${bytecodeHashes.join(', ')}`,
        );

        // Search for events where the first element of eventData matches any of the bytecode hashes
        queryBuilder.andWhere(
          'CAST(event."eventData"->>0 AS TEXT) IN (:...bytecodeHashes)',
          { bytecodeHashes },
        );
      } else {
        // No matching contracts found, add a condition that will return no results
        queryBuilder.andWhere('1 = 0');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to apply search filter for term "${searchTerm}": ${err.message}`,
        err.stack,
      );
      // If search fails, continue without search filter rather than failing the entire query
    }
  }

  /**
   * Apply sorting to the query builder
   */
  private applySorting(
    queryBuilder: SelectQueryBuilder<BlockchainEvent>,
    sortingDto: BlockchainEventsSortingDto,
  ): void {
    const sortBy =
      sortingDto.sortBy || BlockchainEventSortField.BLOCK_TIMESTAMP;
    const sortOrder = sortingDto.sortOrder || 'DESC';

    switch (sortBy) {
      case BlockchainEventSortField.BLOCK_TIMESTAMP:
        queryBuilder.orderBy('event.blockTimestamp', sortOrder);
        // Add secondary sort by logIndex for consistent ordering
        queryBuilder.addOrderBy('event.logIndex', sortOrder);
        break;
      case BlockchainEventSortField.BLOCK_NUMBER:
        queryBuilder.orderBy('event.blockNumber', sortOrder);
        // Add secondary sort by logIndex for consistent ordering
        queryBuilder.addOrderBy('event.logIndex', sortOrder);
        break;
      default:
        // Default to blockTimestamp if invalid sort field
        queryBuilder.orderBy('event.blockTimestamp', sortOrder);
        queryBuilder.addOrderBy('event.logIndex', sortOrder);
        break;
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
