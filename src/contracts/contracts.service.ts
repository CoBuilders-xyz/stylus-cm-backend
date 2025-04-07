import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import { ContractResponse } from './contracts.controller';
import { SortDirection } from '../common/dto/sort.dto';
import { ContractSortingDto } from './dto/contract-sorting.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly contractsUtilsService: ContractsUtilsService,
  ) {}

  async findAll(
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Create query builder
    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.bytecode', 'bytecode')
      .leftJoinAndSelect('contract.blockchain', 'blockchain')
      .where('blockchain.id = :blockchainId', { blockchainId })
      .skip(skip)
      .take(limit);

    // Apply sorting based on sortingDto
    if (sortingDto.sortBy) {
      sortingDto.sortBy.forEach((field, index) => {
        const direction =
          sortingDto.sortDirection?.[index] || SortDirection.DESC;
        if (index === 0) {
          queryBuilder.orderBy(field, direction);
        } else {
          queryBuilder.addOrderBy(field, direction);
        }
      });
    }
    // queryBuilder.orderBy('contract.totalBidInvestment', SortDirection.DESC);
    // queryBuilder.addOrderBy('bytecode.bidBlockNumber', SortDirection.DESC);

    // Log Query
    console.log(queryBuilder.getQueryAndParameters());
    // Execute query
    const [contracts, totalItems] = await queryBuilder.getManyAndCount();

    // Process contracts to add calculated fields
    const processedContracts =
      await this.contractsUtilsService.processContracts(contracts);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: processedContracts as ContractResponse[],
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<ContractResponse | null> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['bytecode', 'blockchain'],
    });

    if (!contract) {
      return null;
    }

    // Process the single contract to add calculated fields
    const processedContract =
      await this.contractsUtilsService.processContract(contract);
    return processedContract as ContractResponse;
  }
}
