import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BlockchainsService } from './blockchains.service';
import { CreateBlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';

@Controller('blockchains')
export class BlockchainsController {
  constructor(private readonly blockchainsService: BlockchainsService) {}

  @Post()
  create(@Body() createBlockchainDto: CreateBlockchainDto) {
    return this.blockchainsService.create(createBlockchainDto);
  }

  @Get()
  findAll() {
    return this.blockchainsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blockchainsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBlockchainDto: UpdateBlockchainDto) {
    return this.blockchainsService.update(+id, updateBlockchainDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blockchainsService.remove(+id);
  }
}
