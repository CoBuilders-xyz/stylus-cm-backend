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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UserContractsService } from './user-contracts.service';
import { AuthenticatedRequest } from '../common/types/custom-types';
import { CreateUserContractDto } from './dto/create-user-contract.dto';
import { GetUserContractDto } from './dto/get-user-contract.dto';
import { GetUserContractsDto } from './dto/get-user-contracts.dto';
import { UpdateUserContractNameDto } from './dto/update-user-contract-name.dto';

@ApiTags('User Contracts')
@ApiBearerAuth()
@Controller('user-contracts')
export class UserContractsController {
  constructor(private readonly userContractsService: UserContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List saved contracts for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Paginated list of user contracts' })
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
  @ApiOperation({ summary: 'Get a single saved contract by ID' })
  @ApiParam({ name: 'id', description: 'User contract UUID' })
  @ApiResponse({ status: 200, description: 'User contract with enriched data' })
  @ApiResponse({ status: 404, description: 'User contract not found' })
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
  @ApiOperation({ summary: 'Save a contract to the user\'s watchlist' })
  @ApiResponse({ status: 201, description: 'Contract saved successfully' })
  @ApiResponse({ status: 409, description: 'Contract already saved' })
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
  @ApiOperation({ summary: 'Update the display name of a saved contract' })
  @ApiParam({ name: 'id', description: 'User contract UUID' })
  @ApiResponse({ status: 200, description: 'Name updated successfully' })
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
  @ApiOperation({ summary: 'Remove a contract from the user\'s watchlist' })
  @ApiParam({ name: 'id', description: 'User contract UUID' })
  @ApiResponse({ status: 204, description: 'Contract removed successfully' })
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
