import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContract } from '../entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ContractSortingDto,
  ContractSortFieldNumeric,
} from '../../contracts/dto/contract-sorting.dto';
import { SearchDto } from '../../common/dto/search.dto';
import { SortDirection } from '../../common/dto/sort.dto';
import { UpdateUserContractNameDto } from '../dto/update-user-contract-name.dto';
import { UserContractsErrorHelpers } from '../user-contracts.errors';
import { MODULE_NAME } from '../constants';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class UserContractCrudService {
  private readonly logger = createModuleLogger(
    UserContractCrudService,
    MODULE_NAME,
  );

  private readonly defaultRelations = [
    'contract',
    'contract.bytecode',
    'blockchain',
    'contract.blockchain',
  ];

  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
  ) {}

  async createUserContract(
    user: User,
    address: string,
    blockchain: Blockchain,
    contract: Contract,
    name?: string,
  ): Promise<UserContract> {
    this.logger.log(
      `Creating user contract for user ${user.id} with address ${address} on blockchain ${blockchain.name}`,
    );

    // Check if user contract already exists
    const existingUserContract = await this.userContractRepository.findOne({
      where: {
        address,
        blockchain: { id: blockchain.id },
        user: { id: user.id },
      },
    });

    if (existingUserContract) {
      this.logger.debug(
        `User contract already exists for address ${address} on blockchain ${blockchain.name}`,
      );
      UserContractsErrorHelpers.throwContractAlreadyExists(
        address,
        blockchain.name,
      );
    }

    const verifiedAddress = address;
    const nonEmptyName = name || verifiedAddress;

    const newUserContract = this.userContractRepository.create({
      address: verifiedAddress,
      blockchain,
      contract,
      user,
      name: nonEmptyName,
    });

    const savedUserContract =
      await this.userContractRepository.save(newUserContract);

    this.logger.log(
      `Successfully created user contract ${savedUserContract.id} for user ${user.id}`,
    );

    return savedUserContract;
  }

  async getUserContracts(
    user: User,
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): Promise<{ data: UserContract[]; total: number }> {
    this.logger.log(
      `Querying user contracts for user ${user.id} on blockchain ${blockchainId}`,
    );

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Create query builder - exact same logic as original
    const queryBuilder = this.userContractRepository
      .createQueryBuilder('userContract')
      .leftJoinAndSelect('userContract.contract', 'contract')
      .leftJoinAndSelect('contract.bytecode', 'bytecode')
      .leftJoinAndSelect('userContract.blockchain', 'blockchain')
      .leftJoinAndSelect('contract.blockchain', 'contractBlockchain')
      .where('blockchain.id = :blockchainId', { blockchainId })
      .andWhere('userContract.user = :userId', { userId: user.id })
      .skip(skip)
      .take(limit);

    if (searchDto.search) {
      this.logger.debug(
        `Applying search filter: "${searchDto.search}" for user ${user.id}`,
      );
      queryBuilder.andWhere(
        '(LOWER(userContract.address) LIKE LOWER(:search) OR LOWER(userContract.name) LIKE LOWER(:search))',
        {
          search: `%${searchDto.search}%`,
        },
      );
    } else if (sortingDto.sortBy) {
      this.logger.debug(
        `Applying sort: ${sortingDto.sortBy.join(', ')} for user ${user.id}`,
      );
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
    const [userContracts, totalItems] = await queryBuilder.getManyAndCount();

    this.logger.log(
      `Successfully retrieved ${userContracts.length} user contracts (total: ${totalItems}) for user ${user.id}`,
    );

    return {
      data: userContracts,
      total: totalItems,
    };
  }

  async getUserContract(user: User, id: string): Promise<UserContract> {
    this.logger.log(`Fetching user contract ${id} for user ${user.id}`);

    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
      relations: this.defaultRelations,
    });

    if (!userContract) {
      this.logger.debug(`User contract ${id} not found for user ${user.id}`);
      UserContractsErrorHelpers.throwUserContractNotFound(id);
      throw new Error('Unreachable');
    }

    this.logger.log(
      `Successfully retrieved user contract ${id} for user ${user.id}`,
    );

    return userContract;
  }

  async updateUserContractName(
    user: User,
    id: string,
    updateNameDto: UpdateUserContractNameDto,
  ): Promise<UserContract> {
    this.logger.log(
      `Updating name for user contract ${id} for user ${user.id} to "${updateNameDto.name}"`,
    );

    // Find the user contract, ensuring it belongs to the authenticated user
    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
      relations: this.defaultRelations,
    });

    if (!userContract) {
      this.logger.debug(`User contract ${id} not found for user ${user.id}`);
      UserContractsErrorHelpers.throwUserContractNotFound(id);
      throw new Error('Unreachable');
    }

    // Update the name
    userContract.name = updateNameDto.name;

    // Save the updated user contract
    const updatedUserContract =
      await this.userContractRepository.save(userContract);

    this.logger.log(
      `Successfully updated name for user contract ${id} for user ${user.id}`,
    );

    return updatedUserContract;
  }

  async deleteUserContract(user: User, id: string): Promise<void> {
    this.logger.log(`Deleting user contract ${id} for user ${user.id}`);

    // Find the user contract, ensuring it belongs to the authenticated user
    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
    });

    if (!userContract) {
      this.logger.debug(`User contract ${id} not found for user ${user.id}`);
      UserContractsErrorHelpers.throwUserContractNotFound(id);
      throw new Error('Unreachable');
    }

    // Delete the user contract
    await this.userContractRepository.remove(userContract);

    this.logger.log(
      `Successfully deleted user contract ${id} for user ${user.id}`,
    );
  }

  async checkContractsSavedByUser(
    user: User,
    contractIds: string[],
    blockchainId?: string,
  ): Promise<Record<string, boolean>> {
    this.logger.log(
      `Checking ${contractIds.length} contracts saved by user ${user.id}${blockchainId ? ` on blockchain ${blockchainId}` : ''}`,
    );

    if (!contractIds.length) {
      this.logger.debug('No contract IDs provided for check');
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

    this.logger.log(
      `Contract check completed: ${savedContractIds.length} of ${contractIds.length} contracts are saved by user ${user.id}`,
    );

    return resultMap;
  }
}
