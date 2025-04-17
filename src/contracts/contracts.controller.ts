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
import { ContractSortingDto } from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { RiskLevel } from './contracts.utils.service';

// Define risk-related types
interface BidRiskLevels {
  highRisk: string;
  midRisk: string;
  lowRisk: string;
}

interface CacheStats {
  utilization: number;
  evictionRate: number;
  medianBidPerByte: string;
  competitiveness: number;
  cacheSizeBytes: string;
  usedCacheSizeBytes: string;
}

// Define the response type interface that includes calculated fields
export interface ContractResponse extends Contract {
  effectiveBid: string;
  evictionRisk: {
    riskLevel: RiskLevel;
    remainingEffectiveBid: string;
    suggestedBids: BidRiskLevels;
    comparisonPercentages: {
      vsHighRisk: number;
      vsMidRisk: number;
      vsLowRisk: number;
    };
    cacheStats: CacheStats;
  };
  biddingHistory?: Array<{
    bytecodeHash: string;
    contractAddress: string;
    bid: string;
    actualBid: string;
    size: string;
    timestamp: Date;
    blockNumber: number;
    transactionHash: string;
  }>;
}

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('')
  findAll(
    @Query('blockchainId') blockchainId: string,
    @Query() paginationDto: PaginationDto,
    @Query() sortingDto: ContractSortingDto,
    @Query() searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    return this.contractsService.findAll(
      blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );
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
