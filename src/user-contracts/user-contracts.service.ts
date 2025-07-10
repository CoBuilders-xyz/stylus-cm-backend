import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ContractSortingDto } from '../contracts/dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { UpdateUserContractNameDto } from './dto/update-user-contract-name.dto';
import {
  UserContractCrudService,
  UserContractValidationService,
  UserContractEnrichmentService,
  UserContractEntityService,
} from './services';
import { MODULE_NAME } from './constants';
import { createModuleLogger } from '../common/utils/logger.util';
import { UserContract } from './entities/user-contract.entity';

@Injectable()
export class UserContractsService {
  private readonly logger = createModuleLogger(
    UserContractsService,
    MODULE_NAME,
  );

  constructor(
    private readonly crudService: UserContractCrudService,
    private readonly validationService: UserContractValidationService,
    private readonly enrichmentService: UserContractEnrichmentService,
    private readonly entityService: UserContractEntityService,
  ) {}

  async createUserContract(
    user: User,
    address: string,
    blockchainId: string,
    name?: string,
  ): Promise<UserContract> {
    this.logger.log(
      `Creating user contract for user ${user.id} with address ${address} on blockchain ${blockchainId}`,
    );

    try {
      // 1. Validate creation - migrated from original logic
      const { blockchain, verifiedAddress } =
        await this.validationService.validateUserContractCreation(
          user,
          address,
          blockchainId,
        );

      this.logger.debug(
        `Validation completed for contract ${verifiedAddress} on blockchain ${blockchain.name}`,
      );

      // 2. Validate on blockchain - migrated from original logic
      const { onChainBytecode } =
        await this.validationService.validateContractOnBlockchain(
          verifiedAddress,
          blockchain,
        );

      this.logger.debug(
        `On-chain validation completed for contract ${verifiedAddress}`,
      );

      // 3. Create or get contract entities - migrated from original logic
      const contract = await this.entityService.getOrCreateContract(
        verifiedAddress,
        blockchain,
        onChainBytecode,
      );

      // 4. Create user contract - migrated from original logic
      const userContract = await this.crudService.createUserContract(
        user,
        verifiedAddress,
        blockchain,
        contract,
        name,
      );

      // 5. Enrich and return - migrated from original logic
      this.logger.log(
        `Successfully created user contract ${userContract.id} for user ${user.id}`,
      );

      return userContract;
    } catch (error) {
      this.logger.error('Failed to create user contract', error);
      throw error;
    }
  }

  async getUserContracts(
    user: User,
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): Promise<any> {
    this.logger.log(
      `Fetching user contracts for user ${user.id} on blockchain ${blockchainId}`,
    );

    try {
      // 1. Get user contracts from database - migrated from original logic
      const { data: userContracts, total } =
        await this.crudService.getUserContracts(
          user,
          blockchainId,
          paginationDto,
          sortingDto,
          searchDto,
        );

      this.logger.debug(
        `Retrieved ${userContracts.length} user contracts (total: ${total})`,
      );

      // 2. Enrich contracts - migrated from original logic
      const enrichedUserContracts =
        await this.enrichmentService.enrichUserContracts(userContracts, user);

      // 3. Create paginated response - migrated from original logic
      const { page = 1, limit = 10 } = paginationDto;

      this.logger.log(
        `Successfully retrieved ${enrichedUserContracts.length} user contracts for user ${user.id}`,
      );

      return this.enrichmentService.createPaginationResponse(
        enrichedUserContracts,
        page,
        limit,
        total,
      );
    } catch (error) {
      this.logger.error('Failed to get user contracts', error);
      throw error;
    }
  }

  async getUserContract(user: User, id: string): Promise<any> {
    this.logger.log(`Fetching user contract ${id} for user ${user.id}`);

    try {
      // 1. Get user contract from database - migrated from original logic
      const userContract = await this.crudService.getUserContract(user, id);

      this.logger.debug(`Retrieved user contract ${id}`);

      // 2. Enrich and return - migrated from original logic
      this.logger.log(
        `Successfully retrieved user contract ${id} for user ${user.id}`,
      );

      return this.enrichmentService.enrichUserContract(
        userContract,
        user,
        true,
      );
    } catch (error) {
      this.logger.error('Failed to get user contract', error);
      throw error;
    }
  }

  async updateUserContractName(
    user: User,
    id: string,
    updateNameDto: UpdateUserContractNameDto,
  ) {
    this.logger.log(
      `Updating name for user contract ${id} for user ${user.id} to "${updateNameDto.name}"`,
    );

    try {
      // Delegate to CRUD service - exact same logic as original
      this.logger.log(
        `Successfully updated name for user contract ${id} for user ${user.id}`,
      );

      return this.crudService.updateUserContractName(user, id, updateNameDto);
    } catch (error) {
      this.logger.error('Failed to update user contract name', error);
      throw error;
    }
  }

  async deleteUserContract(user: User, id: string): Promise<void> {
    this.logger.log(`Deleting user contract ${id} for user ${user.id}`);

    try {
      // Delegate to CRUD service - exact same logic as original
      await this.crudService.deleteUserContract(user, id);

      this.logger.log(
        `Successfully deleted user contract ${id} for user ${user.id}`,
      );
    } catch (error) {
      this.logger.error('Failed to delete user contract', error);
      throw error;
    }
  }

  /**
   * Check if the given contracts are saved by the user
   * @param user The user to check
   * @param contractIds Array of contract IDs to check
   * @param blockchainId Optional blockchain ID filter
   * @returns A map of contract IDs to boolean values indicating if they are saved by the user
   */
  async checkContractsSavedByUser(
    user: User,
    contractIds: string[],
    blockchainId?: string,
  ): Promise<Record<string, boolean>> {
    this.logger.log(
      `Checking ${contractIds.length} contracts saved by user ${user.id}${blockchainId ? ` on blockchain ${blockchainId}` : ''}`,
    );

    try {
      // Delegate to CRUD service - exact same logic as original
      this.logger.debug(
        `Contract check completed for ${contractIds.length} contracts`,
      );

      return this.crudService.checkContractsSavedByUser(
        user,
        contractIds,
        blockchainId,
      );
    } catch (error) {
      this.logger.error('Failed to check contracts saved by user', error);
      throw error;
    }
  }
}
