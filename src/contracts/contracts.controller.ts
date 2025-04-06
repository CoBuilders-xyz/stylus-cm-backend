import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';

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
  ): Promise<ContractResponse[]> {
    return this.contractsService.findAll(blockchainId);
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
