import { Controller, Get, Param } from '@nestjs/common';
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

  // async findOne(@Param('id') id: string) {
  //   return this.blockchainsService.findOne();
  // }
}
