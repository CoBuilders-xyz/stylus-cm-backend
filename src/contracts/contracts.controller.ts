import { Controller, Get, Param, Query, Request, Logger } from '@nestjs/common';
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
import { ContractErrorHelpers } from './contracts.errors';

@Controller('contracts')
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(private readonly contractsService: ContractsService) {}

  /**
   * Get all contracts with pagination, sorting, and filtering
   *
   * The response will include a boolean 'isSavedByUser' property that indicates
   * whether each contract is saved by the authenticated user.
   */
  @Get('')
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() contractQuery: ContractQueryDto,
    @Query() paginationDto: PaginationDto,
    @Query() sortingDto: ContractSortingDto,
    @Query() searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    try {
      this.logger.log(
        `Finding contracts for user ${req.user.address}, blockchain ${contractQuery.blockchainId}`,
      );

      const result = await this.contractsService.findAll(
        req.user,
        contractQuery.blockchainId,
        paginationDto,
        sortingDto,
        searchDto,
      );

      this.logger.log(
        `Successfully returned ${result.data.length} contracts for user ${req.user.address}`,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find contracts for user ${req.user.address}: ${err.message}`,
        err.stack,
      );
      throw error; // Re-throw to let NestJS handle the HTTP response
    }
  }

  @Get('suggest-bids/by-address/:address')
  async getSuggestedBidsByAddress(
    @Param() params: SuggestedBidsByAddressParamsDto,
    @Query() query: SuggestedBidsQueryDto,
  ): Promise<SuggestedBidsResponse> {
    try {
      this.logger.log(
        `Getting suggested bids for address ${params.address} on blockchain ${query.blockchainId}`,
      );

      const result = await this.contractsService.getSuggestedBidsByAddress(
        params.address,
        query.blockchainId,
      );

      this.logger.log(
        `Successfully calculated suggested bids for address ${params.address}`,
      );
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get suggested bids for address ${params.address}: ${err.message}`,
        err.stack,
      );
      throw error; // Re-throw to let NestJS handle the HTTP response
    }
  }

  @Get('suggest-bids/by-size/:size')
  async getSuggestedBidsBySize(
    @Param('size') sizeParam: string,
    @Query() query: SuggestedBidsQueryDto,
  ): Promise<SuggestedBidsResponse> {
    try {
      this.logger.log(
        `Getting suggested bids for size ${sizeParam} on blockchain ${query.blockchainId}`,
      );

      // Parse the size parameter to a number
      const size = parseInt(sizeParam, 10);
      if (isNaN(size) || size <= 0) {
        this.logger.warn(`Invalid size parameter provided: ${sizeParam}`);
        ContractErrorHelpers.throwInvalidBytecodeSize();
      }

      const result = await this.contractsService.getSuggestedBidsBySize(
        size,
        query.blockchainId,
      );

      this.logger.log(
        `Successfully calculated suggested bids for size ${size} bytes`,
      );
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get suggested bids for size ${sizeParam}: ${err.message}`,
        err.stack,
      );
      throw error; // Re-throw to let NestJS handle the HTTP response
    }
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
    try {
      this.logger.log(`Finding contract ${id} for user ${req.user.address}`);

      const contract = await this.contractsService.findOne(id, req.user);

      this.logger.log(
        `Successfully found contract ${id} for user ${req.user.address}`,
      );
      return contract;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find contract ${id} for user ${req.user.address}: ${err.message}`,
        err.stack,
      );
      throw error; // Re-throw to let NestJS handle the HTTP response
    }
  }
}
