import { Controller, Get, Post, Query, Request, Body } from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { AuthenticatedRequest } from 'src/types/custom-types';
import { CreateUserContractDto } from './dto/create-user-contract.dto';
import { SearchDto } from 'src/common/dto/search.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ContractSortingDto } from 'src/contracts/dto/contract-sorting.dto';

@Controller('user-contracts')
export class UserContractsController {
  constructor(private readonly userContractsService: UserContractsService) {}

  @Get()
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('blockchainId') blockchainId: string,
    @Query() paginationDto: PaginationDto,
    @Query() sortingDto: ContractSortingDto,
    @Query() searchDto: SearchDto,
  ) {
    return this.userContractsService.getUserContracts(
      req.user,
      blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );
  }

  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateUserContractDto,
  ) {
    return this.userContractsService.createUserContract(
      req.user,
      body.address,
      body.blockchainId,
      body.name,
    );
  }
}
