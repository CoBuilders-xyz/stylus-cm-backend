import { Controller, Get, Post, Query, Request, Body } from '@nestjs/common';
import { UserContractsService } from './user-contracts.service';
import { AuthenticatedRequest } from 'src/types/custom-types';
import { CreateUserContractDto } from './dto/create-user-contract.dto';

@Controller('user-contracts')
export class UserContractsController {
  constructor(private readonly userContractsService: UserContractsService) {}

  @Get()
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('blockchainId') blockchainId: string,
  ) {
    return this.userContractsService.getUserContracts(req.user, blockchainId);
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
