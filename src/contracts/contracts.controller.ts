import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';

// Define the response type interface that includes calculated fields
export interface ContractResponse extends Contract {
  effectiveBid: string;
  evictionRisk: number;
}

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('')
  findAll(
    @Query('blockchainId') blockchainId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    return this.contractsService.findAll(blockchainId, paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ContractResponse> {
    const contract = await this.contractsService.findOne(id);
    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }
    return contract;
  }
}
