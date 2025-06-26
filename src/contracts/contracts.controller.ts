import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
  Request,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import { ContractSortingDto } from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { RiskLevel } from './interfaces/contract.interfaces';
import { AuthenticatedRequest } from '../common/types/custom-types';

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
  minBid: string;
}

// Define the response type interface that includes calculated fields
export interface ContractResponse extends Contract {
  effectiveBid?: string;
  evictionRisk?: {
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
  suggestedBids?: {
    suggestedBids: BidRiskLevels;
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
    originAddress: string;
  }>;
  isSavedByUser?: boolean;
}

// Define suggested bids response interface
export interface SuggestedBidsResponse {
  suggestedBids: BidRiskLevels;
  cacheStats: CacheStats;
}

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /**
   * Get all contracts with pagination, sorting, and filtering
   *
   * The response will include a boolean 'isSavedByUser' property that indicates
   * whether each contract is saved by the authenticated user.
   */
  @Get('')
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('blockchainId') blockchainId: string,
    @Query() paginationDto: PaginationDto,
    @Query() sortingDto: ContractSortingDto,
    @Query() searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    return this.contractsService.findAll(
      req.user,
      blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );
  }

  @Get('suggest-bids/by-address/:address')
  async getSuggestedBidsByAddress(
    @Param('address') address: string,
    @Query('blockchainId') blockchainId: string,
  ): Promise<SuggestedBidsResponse> {
    if (!blockchainId) {
      throw new NotFoundException('blockchainId query parameter is required');
    }
    return this.contractsService.getSuggestedBidsByAddress(
      address,
      blockchainId,
    );
  }

  @Get('suggest-bids/by-size/:size')
  async getSuggestedBidsBySize(
    @Param('size') sizeParam: string,
    @Query('blockchainId') blockchainId: string,
  ): Promise<SuggestedBidsResponse> {
    if (!blockchainId) {
      throw new NotFoundException('blockchainId query parameter is required');
    }

    // Parse the size parameter to a number
    const size = parseInt(sizeParam, 10);
    if (isNaN(size) || size <= 0) {
      throw new NotFoundException('Size must be a positive number');
    }

    return this.contractsService.getSuggestedBidsBySize(size, blockchainId);
  }

  /**
   * Get a single contract by ID
   *
   * The response will include a boolean 'isSavedByUser' property that indicates
   * whether the contract is saved by the authenticated user.
   */
  @Get(':id')
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ContractResponse> {
    const contract = await this.contractsService.findOne(id, req.user);
    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }
    return contract;
  }
}
