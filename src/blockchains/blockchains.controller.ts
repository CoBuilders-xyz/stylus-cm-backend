import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';

@Controller('blockchains')
export class BlockchainsController {
  constructor(private readonly blockchainsService: BlockchainsService) {}

  @Get()
  async findAll() {
    return this.blockchainsService.findAll();
  }

  @Get(':blockchainId')
  async getBlockchainData(@Param('blockchainId') blockchainId: string) {
    return this.blockchainsService.getBlockchainData(blockchainId);
  }

  @Get(':blockchainId/total-bytecodes')
  async getTotalBytecodes(@Param('blockchainId') blockchainId: string) {
    return this.blockchainsService.getTotalBytecodes(blockchainId);
  }

  @Get(':blockchainId/cache-stats')
  async getCacheStats(@Param('blockchainId') blockchainId: string) {
    return this.blockchainsService.getCacheStats(blockchainId);
  }

  @Get(':blockchainId/bid-trends')
  async getBidTrends(
    @Param('blockchainId') blockchainId: string,
    @Query('timespan') timespan: string,
  ) {
    return this.blockchainsService.getBidPlacementTrends(
      timespan,
      blockchainId,
    );
  }

  @Get(':blockchainId/bid-average')
  async getBidAverage(
    @Param('blockchainId') blockchainId: string,
    @Query('timespan') timespan: string,
    @Query('maxSize') maxSize: number,
    @Query('minSize') minSize: number,
  ) {
    return this.blockchainsService.getAverageBid(
      timespan,
      blockchainId,
      maxSize,
      minSize,
    );
  }

  // async findOne(@Param('id') id: string) {
  //   return this.blockchainsService.findOne();
  // }
}
