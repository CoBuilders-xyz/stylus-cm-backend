import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Contract } from '../entities/contract.entity';
import { UserContract } from '../../user-contracts/entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import {
  ContractSortingDto,
  ContractSortFieldNumeric,
} from '../dto/contract-sorting.dto';
import { SortDirection } from '../../common/dto/sort.dto';
import { SearchDto } from '../../common/dto/search.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Service responsible for building complex queries for contracts.
 * Separates query logic from business logic for better testability and reusability.
 */
@Injectable()
export class ContractQueryBuilderService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(UserContract)
    private readonly userContractRepository: Repository<UserContract>,
  ) {}

  /**
   * Create a base query builder for contracts with common joins
   */
  createBaseContractQuery(): SelectQueryBuilder<Contract> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.bytecode', 'bytecode')
      .leftJoinAndSelect('contract.blockchain', 'blockchain');
  }

  /**
   * Build a complete query for finding contracts with filtering, sorting, and pagination
   */
  buildFindAllQuery(
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): SelectQueryBuilder<Contract> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.createBaseContractQuery()
      .where('blockchain.id = :blockchainId', { blockchainId })
      .skip(skip)
      .take(limit);

    // Apply search filter
    this.applySearchFilter(queryBuilder, searchDto);

    // Apply sorting
    this.applySorting(queryBuilder, sortingDto, searchDto);

    return queryBuilder;
  }

  /**
   * Build query to check which contracts are saved by a user
   */
  buildUserContractsQuery(
    user: User,
    contractIds: string[],
    blockchainId?: string,
  ): SelectQueryBuilder<UserContract> {
    const queryBuilder = this.userContractRepository
      .createQueryBuilder('userContract')
      .leftJoin('userContract.contract', 'contract')
      .select('contract.id', 'contractId')
      .addSelect('userContract.name', 'contractName')
      .where('userContract.user = :userId', { userId: user.id })
      .andWhere('contract.id IN (:...contractIds)', { contractIds });

    if (blockchainId) {
      queryBuilder.andWhere('userContract.blockchain = :blockchainId', {
        blockchainId,
      });
    }

    return queryBuilder;
  }

  /**
   * Apply search filtering to the query
   */
  private applySearchFilter(
    queryBuilder: SelectQueryBuilder<Contract>,
    searchDto: SearchDto,
  ): void {
    if (searchDto.search) {
      queryBuilder.andWhere('LOWER(contract.address) LIKE LOWER(:search)', {
        search: `%${searchDto.search}%`,
      });
    }
  }

  /**
   * Apply sorting to the query
   */
  private applySorting(
    queryBuilder: SelectQueryBuilder<Contract>,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): void {
    if (!sortingDto.sortBy || searchDto.search) {
      return; // Skip sorting if search is active or no sort specified
    }

    sortingDto.sortBy.forEach((field, index) => {
      const direction = sortingDto.sortDirection?.[index] || SortDirection.DESC;

      if (this.isNumericField(field)) {
        this.addNumericSort(queryBuilder, field, direction, index);
      } else {
        this.addRegularSort(queryBuilder, field, direction, index);
      }
    });
  }

  /**
   * Check if a field should be treated as numeric for sorting
   */
  private isNumericField(field: string): boolean {
    return (Object.values(ContractSortFieldNumeric) as string[]).includes(
      field,
    );
  }

  /**
   * Add numeric field sorting with proper casting
   */
  private addNumericSort(
    queryBuilder: SelectQueryBuilder<Contract>,
    field: string,
    direction: SortDirection,
    index: number,
  ): void {
    const alias = `${field.toLowerCase().replace(/\./g, '_')}_numeric`;
    queryBuilder.addSelect(`CAST(${field} AS NUMERIC)`, alias);

    if (index === 0) {
      queryBuilder.orderBy(alias, direction);
    } else {
      queryBuilder.addOrderBy(alias, direction);
    }
  }

  /**
   * Add regular field sorting
   */
  private addRegularSort(
    queryBuilder: SelectQueryBuilder<Contract>,
    field: string,
    direction: SortDirection,
    index: number,
  ): void {
    if (index === 0) {
      queryBuilder.orderBy(field, direction);
    } else {
      queryBuilder.addOrderBy(field, direction);
    }
  }
}
