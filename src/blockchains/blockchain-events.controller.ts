import { Controller, Get, Query } from '@nestjs/common';
import { BlockchainEventsService } from './services/blockchain-events.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { SearchDto } from '../common/dto/search.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import { BlockchainEventsQueryDto, BlockchainEventsSortingDto } from './dto';
import { BlockchainEventResponse } from './interfaces';
import { Public } from '../auth/auth.guard';
import { createControllerLogger } from '../common/utils/logger.util';
import { MODULE_NAME } from './constants';

@Controller('blockchain-events')
export class BlockchainEventsController {
  private readonly logger = createControllerLogger(
    BlockchainEventsController,
    MODULE_NAME,
  );

  constructor(
    private readonly blockchainEventsService: BlockchainEventsService,
  ) {}

  /**
   * Get all blockchain events with pagination, search, and sorting
   * Only returns Insert and Delete events
   * This endpoint is unauthenticated
   */
  @Public()
  @Get()
  async findAll(
    @Query() queryDto: BlockchainEventsQueryDto,
    @Query() paginationDto: PaginationDto,
    @Query() searchDto: SearchDto,
    @Query() sortingDto: BlockchainEventsSortingDto,
  ): Promise<PaginationResponse<BlockchainEventResponse>> {
    try {
      this.logger.log(
        `Finding blockchain events with filters: ${JSON.stringify(queryDto)}, search: ${searchDto.search}, sorting: ${JSON.stringify(sortingDto)}`,
      );

      const result = await this.blockchainEventsService.findAll(
        queryDto,
        paginationDto,
        searchDto,
        sortingDto,
      );

      this.logger.log(
        `Successfully returned ${result.data.length} blockchain events`,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find blockchain events: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
