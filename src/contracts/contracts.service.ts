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
import {
  ContractSortingDto,
  ContractSortFieldNumeric,
} from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { User } from '../users/entities/user.entity';
import { UserContract } from '../user-contracts/entities/user-contract.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(UserContract)
    private readonly userContractRepository: Repository<UserContract>,
    private readonly contractsUtilsService: ContractsUtilsService,
  ) {}

  /**
   * Check if contracts are saved by a user
   * @param user The user to check
   * @param contractIds Array of contract IDs to check
   * @param blockchainId Optional blockchain ID filter
   * @returns A map of contract IDs to boolean values indicating if they are saved by the user
   */
  private async checkContractsSavedByUser(
    user: User,
    contractIds: string[],
    blockchainId?: string,
  ): Promise<Record<string, boolean>> {
    if (!contractIds.length) {
      return {};
    }

    // Create query to find all user contracts for these contract IDs and user
    const queryBuilder = this.userContractRepository
      .createQueryBuilder('userContract')
      .leftJoin('userContract.contract', 'contract')
      .select('contract.id', 'contractId')
      .where('userContract.user = :userId', { userId: user.id })
      .andWhere('contract.id IN (:...contractIds)', { contractIds });

    // Add optional blockchain filter
    if (blockchainId) {
      queryBuilder.andWhere('userContract.blockchain = :blockchainId', {
        blockchainId,
      });
    }

    // Execute query to get all saved contract IDs
    const savedContractResults = await queryBuilder.getRawMany();
    const savedContractIds = savedContractResults.map(
      (result: { contractId: string }) => result.contractId,
    );

    // Create result map with true for saved contracts, false for others
    const resultMap: Record<string, boolean> = {};
    contractIds.forEach((id) => {
      resultMap[id] = savedContractIds.includes(id);
    });

    return resultMap;
  }

  async findAll(
    user: User,
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

        // Check if the current field (string) is one of the string values in ContractSortFieldNumeric enum
        if (
          (Object.values(ContractSortFieldNumeric) as string[]).includes(field)
        ) {
          // Generate a safe, all-lowercase alias for the casted field
          const alias = `${field.toLowerCase().replace(/\./g, '_')}_numeric`;
          queryBuilder.addSelect(`CAST(${field} AS NUMERIC)`, alias);

          if (index === 0) {
            queryBuilder.orderBy(alias, direction);
          } else {
            queryBuilder.addOrderBy(alias, direction);
          }
        } else {
          // Sort other fields normally
          if (index === 0) {
            queryBuilder.orderBy(field, direction);
          } else {
            queryBuilder.addOrderBy(field, direction);
          }
        }
      });
    }

    // Execute query
    const [contracts, totalItems] = await queryBuilder.getManyAndCount();

    // Process contracts to add calculated fields
    const processedContracts =
      await this.contractsUtilsService.processContracts(contracts);

    // Get contract IDs to check if they're saved by the user
    const contractIds = contracts.map((contract) => contract.id);

    // Check which contracts are saved by the user
    const savedContractsMap = await this.checkContractsSavedByUser(
      user,
      contractIds,
      blockchainId,
    );

    // Add isSavedByUser property to each contract
    const processedContractsWithSavedStatus = processedContracts.map(
      (contract) => ({
        ...contract,
        isSavedByUser: savedContractsMap[contract.id] || false,
      }),
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: processedContractsWithSavedStatus as ContractResponse[],
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

  async findOne(id: string, user?: User): Promise<ContractResponse | null> {
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

    // Check if contract is saved by user if a user is provided
    if (user) {
      const savedContractsMap = await this.checkContractsSavedByUser(
        user,
        [contract.id],
        contract.blockchain.id,
      );

      // Add isSavedByUser property
      (processedContract as ContractResponse).isSavedByUser =
        savedContractsMap[contract.id] || false;
    }

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
