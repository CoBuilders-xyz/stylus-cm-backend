import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { Public } from '../auth/auth.guard';
import { GetBlockchainDto, BidTrendsQueryDto, BidAverageQueryDto } from './dto';

@Controller('blockchains')
export class BlockchainsController {
  constructor(private readonly blockchainsService: BlockchainsService) {}

  @Public()
  @Get()
  async findAll() {
    return this.blockchainsService.findAll();
  }

  @Get(':blockchainId')
  async getBlockchainData(
    @Param(new ValidationPipe()) params: GetBlockchainDto,
  ) {
    return this.blockchainsService.getBlockchainData(params.blockchainId);
  }

  @Public()
  @Get(':blockchainId/total-bytecodes')
  async getTotalBytecodes(
    @Param(new ValidationPipe()) params: GetBlockchainDto,
  ) {
    return this.blockchainsService.getTotalBytecodes(params.blockchainId);
  }

  @Public()
  @Get(':blockchainId/cache-stats')
  async getCacheStats(@Param(new ValidationPipe()) params: GetBlockchainDto) {
    return this.blockchainsService.getCacheStats(params.blockchainId);
  }

  @Public()
  @Get(':blockchainId/bid-trends')
  async getBidTrends(
    @Param('blockchainId', ParseUUIDPipe) blockchainId: string,
    @Query(new ValidationPipe({ transform: true })) query: BidTrendsQueryDto,
  ) {
    return this.blockchainsService.getBidPlacementTrends(
      query.timespan,
      blockchainId,
    );
  }

  @Public()
  @Get(':blockchainId/bid-average')
  async getBidAverage(
    @Param('blockchainId', ParseUUIDPipe) blockchainId: string,
    @Query(new ValidationPipe({ transform: true })) query: BidAverageQueryDto,
  ) {
    const { timespan, maxSize, minSize } = query;
    return this.blockchainsService.getAverageBid(
      timespan,
      blockchainId,
      maxSize || 0,
      minSize || 0,
    );
  }

  // async findOne(@Param('id') id: string) {
  //   return this.blockchainsService.findOne();
  // }
}
