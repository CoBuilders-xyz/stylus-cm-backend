import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
  Request,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import { SearchDto } from '../common/dto/search.dto';
import {
  ContractResponse,
  SuggestedBidsResponse,
} from './interfaces/contract.interfaces';
import { AuthenticatedRequest } from '../common/types/custom-types';
import {
  ContractSortingDto,
  ContractQueryDto,
  SuggestedBidsByAddressParamsDto,
  SuggestedBidsQueryDto,
} from './dto';

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
    @Query() contractQuery: ContractQueryDto,
    @Query() paginationDto: PaginationDto,
    @Query() sortingDto: ContractSortingDto,
    @Query() searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    return this.contractsService.findAll(
      req.user,
      contractQuery.blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );
  }

  @Get('suggest-bids/by-address/:address')
  async getSuggestedBidsByAddress(
    @Param() params: SuggestedBidsByAddressParamsDto,
    @Query() query: SuggestedBidsQueryDto,
  ): Promise<SuggestedBidsResponse> {
    return this.contractsService.getSuggestedBidsByAddress(
      params.address,
      query.blockchainId,
    );
  }

  @Get('suggest-bids/by-size/:size')
  async getSuggestedBidsBySize(
    @Param('size') sizeParam: string,
    @Query() query: SuggestedBidsQueryDto,
  ): Promise<SuggestedBidsResponse> {
    // Parse the size parameter to a number
    const size = parseInt(sizeParam, 10);
    if (isNaN(size) || size <= 0) {
      throw new NotFoundException('Size must be a positive number');
    }

    return this.contractsService.getSuggestedBidsBySize(
      size,
      query.blockchainId,
    );
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
