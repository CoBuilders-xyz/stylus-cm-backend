import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { BlockchainsService } from './blockchains.service';
import { Public } from '../auth/auth.guard';
import { GetBlockchainDto, BidTrendsQueryDto, BidAverageQueryDto } from './dto';
import { createControllerLogger } from '../common/utils/logger.util';
import { MODULE_NAME } from './constants';

@ApiTags('Blockchains')
@ApiBearerAuth()
@Controller('blockchains')
export class BlockchainsController {
  private readonly logger = createControllerLogger(
    BlockchainsController,
    MODULE_NAME,
  );

  constructor(private readonly blockchainsService: BlockchainsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all enabled blockchains' })
  @ApiResponse({ status: 200, description: 'Array of blockchain configurations' })
  async findAll() {
    this.logger.log('GET /blockchains - Fetching all enabled blockchains');
    const result = await this.blockchainsService.findAll();
    this.logger.log(`GET /blockchains - Returned ${result.length} blockchains`);
    return result;
  }

  @Get(':blockchainId')
  @ApiOperation({ summary: 'Get comprehensive blockchain data including bytecode counts' })
  @ApiParam({ name: 'blockchainId', description: 'Blockchain UUID' })
  @ApiResponse({ status: 200, description: 'Blockchain data with statistics' })
  async getBlockchainData(
    @Param(new ValidationPipe()) params: GetBlockchainDto,
  ) {
    this.logger.log(
      `GET /blockchains/${params.blockchainId} - Fetching comprehensive blockchain data`,
    );
    const result = await this.blockchainsService.getBlockchainData(
      params.blockchainId,
    );
    this.logger.log(
      `GET /blockchains/${params.blockchainId} - Returned comprehensive data with ${result.bytecodeCount} bytecodes`,
    );
    return result;
  }

  @Public()
  @Get(':blockchainId/total-bytecodes')
  @ApiOperation({ summary: 'Get total bytecode statistics for a blockchain' })
  @ApiParam({ name: 'blockchainId', description: 'Blockchain UUID' })
  @ApiResponse({ status: 200, description: 'Bytecode count statistics' })
  async getTotalBytecodes(
    @Param(new ValidationPipe()) params: GetBlockchainDto,
  ) {
    this.logger.log(
      `GET /blockchains/${params.blockchainId}/total-bytecodes - Fetching bytecode statistics`,
    );
    const result = await this.blockchainsService.getTotalBytecodes(
      params.blockchainId,
    );
    this.logger.log(
      `GET /blockchains/${params.blockchainId}/total-bytecodes - Returned ${result.bytecodeCount} bytecodes`,
    );
    return result;
  }

  @Public()
  @Get(':blockchainId/cache-stats')
  @ApiOperation({ summary: 'Get cache statistics (size, utilization, minimum bid)' })
  @ApiParam({ name: 'blockchainId', description: 'Blockchain UUID' })
  @ApiResponse({ status: 200, description: 'Cache statistics' })
  async getCacheStats(@Param(new ValidationPipe()) params: GetBlockchainDto) {
    this.logger.log(
      `GET /blockchains/${params.blockchainId}/cache-stats - Fetching cache statistics`,
    );
    const result = await this.blockchainsService.getCacheStats(
      params.blockchainId,
    );
    this.logger.log(
      `GET /blockchains/${params.blockchainId}/cache-stats - Returned cache stats (${((Number(result.queueSize) / Number(result.cacheSize)) * 100).toFixed(1)}% full)`,
    );
    return result;
  }

  @Public()
  @Get(':blockchainId/bid-trends')
  @ApiOperation({ summary: 'Get bid placement trends over a time period' })
  @ApiParam({ name: 'blockchainId', description: 'Blockchain UUID' })
  @ApiResponse({ status: 200, description: 'Bid trend data with insert/delete counts' })
  async getBidTrends(
    @Param('blockchainId', ParseUUIDPipe) blockchainId: string,
    @Query(new ValidationPipe({ transform: true })) query: BidTrendsQueryDto,
  ) {
    this.logger.log(
      `GET /blockchains/${blockchainId}/bid-trends - Fetching bid trends (${query.timespan})`,
    );
    const result = await this.blockchainsService.getBidPlacementTrends(
      query.timespan,
      blockchainId,
    );
    this.logger.log(
      `GET /blockchains/${blockchainId}/bid-trends - Returned ${result.global.insertCount} inserts, ${result.global.deleteCount} deletes, ${result.global.netChange} net change across ${result.periods.length} periods`,
    );
    return result;
  }

  @Public()
  @Get(':blockchainId/bid-average')
  @ApiOperation({ summary: 'Get average bid amount over a time period with optional size filter' })
  @ApiParam({ name: 'blockchainId', description: 'Blockchain UUID' })
  @ApiResponse({ status: 200, description: 'Average bid data' })
  async getBidAverage(
    @Param('blockchainId', ParseUUIDPipe) blockchainId: string,
    @Query(new ValidationPipe({ transform: true })) query: BidAverageQueryDto,
  ) {
    const sizeFilter =
      query.maxSize || query.minSize
        ? ` with size filter: ${query.minSize || 0}-${query.maxSize || '∞'}KB`
        : '';
    this.logger.log(
      `GET /blockchains/${blockchainId}/bid-average - Fetching average bid (${query.timespan})${sizeFilter}`,
    );

    const { timespan, maxSize, minSize } = query;
    const result = await this.blockchainsService.getAverageBid(
      timespan,
      blockchainId,
      maxSize || 0,
      minSize || 0,
    );

    this.logger.log(
      `GET /blockchains/${blockchainId}/bid-average - Returned average: ${result.global.parsedAverageBid} ETH (${result.global.count} bids)`,
    );
    return result;
  }

  // async findOne(@Param('id') id: string) {
  //   return this.blockchainsService.findOne();
  // }
}
