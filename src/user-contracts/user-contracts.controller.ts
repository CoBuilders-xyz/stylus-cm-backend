import {
  Controller,
  Get,
  Post,
  Query,
  Request,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { AuthenticatedRequest } from '../common/types/custom-types';
import { CreateUserContractDto } from './dto/create-user-contract.dto';
import { GetUserContractDto } from './dto/get-user-contract.dto';
import { GetUserContractsDto } from './dto/get-user-contracts.dto';
import { UpdateUserContractNameDto } from './dto/update-user-contract-name.dto';

@Controller('user-contracts')
export class UserContractsController {
  constructor(private readonly userContractsService: UserContractsService) {}

  @Get()
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() getUserContractsDto: GetUserContractsDto,
  ) {
    // Convert DTO to service method parameters
    const paginationDto = {
      page: getUserContractsDto.page,
      limit: getUserContractsDto.limit,
    };

    const sortingDto = {
      sortBy: getUserContractsDto.sortBy,
      sortDirection: getUserContractsDto.sortDirection,
    };

    const searchDto = {
      search: getUserContractsDto.search,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.userContractsService.getUserContracts(
      req.user,
      getUserContractsDto.blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );
  }

  @Get(':id')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param() getUserContractDto: GetUserContractDto,
  ) {
    return this.userContractsService.getUserContract(
      req.user,
      getUserContractDto.id,
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

  @Patch(':id/name')
  async updateName(
    @Request() req: AuthenticatedRequest,
    @Param() getUserContractDto: GetUserContractDto,
    @Body() updateNameDto: UpdateUserContractNameDto,
  ) {
    return this.userContractsService.updateUserContractName(
      req.user,
      getUserContractDto.id,
      updateNameDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param() getUserContractDto: GetUserContractDto,
  ): Promise<void> {
    return this.userContractsService.deleteUserContract(
      req.user,
      getUserContractDto.id,
    );
  }
}
