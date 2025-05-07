import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractsUtilsService } from './contracts.utils.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import {
  ContractResponse,
  SuggestedBidsResponse,
} from './contracts.controller';
import { SortDirection } from '../common/dto/sort.dto';
import { ContractSortingDto } from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';

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
    searchDto: SearchDto,
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

    if (searchDto.search) {
      queryBuilder.andWhere('contract.address LIKE :search', {
        search: `%${searchDto.search}%`,
      });
    } else if (sortingDto.sortBy) {
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

    // The types now match so we can safely cast
    return processedContract as ContractResponse;
  }

  /**
   * Get suggested bids for a contract address
   * @param address Contract address
   * @param blockchainId Blockchain ID
   * @returns Suggested bids with cache statistics
   */
  async getSuggestedBidsByAddress(
    address: string,
    blockchainId: string,
  ): Promise<SuggestedBidsResponse> {
    return this.contractsUtilsService.getSuggestedBidsByAddress(
      address,
      blockchainId,
    );
  }

  /**
   * Get suggested bids for a contract bytecode size
   * @param size Bytecode size in bytes
   * @param blockchainId Blockchain ID
   * @returns Suggested bids with cache statistics
   */
  async getSuggestedBidsBySize(
    size: number,
    blockchainId: string,
  ): Promise<SuggestedBidsResponse> {
    return this.contractsUtilsService.getSuggestedBids(size, blockchainId);
  }
}
