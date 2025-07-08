import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import {
  ContractEnrichmentService,
  ContractBidAssessmentService,
  ContractQueryBuilderService,
} from './services';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/pagination-response.interface';
import {
  ContractResponse,
  SuggestedBidsResponse,
} from './interfaces/contract.interfaces';
import { ContractSortingDto } from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { User } from '../users/entities/user.entity';
import { ContractErrorHelpers } from './contracts.errors';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly contractEnrichmentService: ContractEnrichmentService,
    private readonly contractBidAssessmentService: ContractBidAssessmentService,
    private readonly contractQueryBuilderService: ContractQueryBuilderService,
  ) {}

  async findAll(
    user: User | null,
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    try {
      this.logger.log(
        `Finding contracts for blockchain ${blockchainId}, user ${user?.address || 'anonymous'}, page ${paginationDto.page}`,
      );

      const { page = 1, limit = 10 } = paginationDto;

      // Validate blockchain ID format
      if (!blockchainId || typeof blockchainId !== 'string') {
        this.logger.warn(`Invalid blockchain ID provided: ${blockchainId}`);
        ContractErrorHelpers.throwInvalidBlockchainId();
      }

      // Use query builder service for complex query logic
      const queryBuilder = this.contractQueryBuilderService.buildFindAllQuery(
        blockchainId,
        paginationDto,
        sortingDto,
        searchDto,
      );

      // Execute query
      const [contracts, totalItems] = await queryBuilder.getManyAndCount();

      this.logger.debug(
        `Found ${contracts.length} contracts out of ${totalItems} total for blockchain ${blockchainId}`,
      );

      // Process contracts to add calculated fields
      const processedContracts =
        await this.contractEnrichmentService.processContracts(contracts);

      // Only check for saved contracts if user is provided
      let processedContractsWithSavedStatus = processedContracts;
      if (user) {
        // Get contract IDs to check if they're saved by the user
        const contractIds = contracts.map((contract) => contract.id);

        // Check which contracts are saved by the user using query builder service
        const savedContractsMap = await this.checkContractsSavedByUser(
          user,
          contractIds,
          blockchainId,
        );

        // Add isSavedByUser property to each contract
        processedContractsWithSavedStatus = processedContracts.map(
          (contract) => ({
            ...contract,
            isSavedByUser: savedContractsMap[contract.id] || false,
          }),
        );
      } else {
        // For anonymous users, set isSavedByUser to false for all contracts
        processedContractsWithSavedStatus = processedContracts.map(
          (contract) => ({
            ...contract,
            isSavedByUser: false,
          }),
        );
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);

      this.logger.log(
        `Successfully retrieved ${processedContractsWithSavedStatus.length} contracts for user ${user?.address || 'anonymous'}`,
      );

      return {
        data: processedContractsWithSavedStatus,
        meta: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find contracts for blockchain ${blockchainId}: ${err.message}`,
        err.stack,
      );

      // Re-throw known contract errors
      if (
        err.name === 'NotFoundException' ||
        err.name === 'BadRequestException'
      ) {
        throw error;
      }

      // For unknown errors, throw a generic internal error
      ContractErrorHelpers.throwBidCalculationFailed();

      // This line should never be reached, but TypeScript requires it
      throw new Error('Unexpected error in findAll');
    }
  }

  async findOne(id: string, user?: User): Promise<ContractResponse> {
    try {
      this.logger.log(`Finding contract with ID: ${id}`);

      // Validate contract ID
      if (!id || typeof id !== 'string') {
        this.logger.warn(`Invalid contract ID provided: ${id}`);
        ContractErrorHelpers.throwContractNotFound();
      }

      const contract = await this.contractRepository.findOne({
        where: { id },
        relations: ['bytecode', 'blockchain'],
      });

      if (!contract) {
        this.logger.warn(`Contract not found with ID: ${id}`);
        ContractErrorHelpers.throwContractNotFound();
      }

      // At this point contract is guaranteed to be non-null due to the throw above
      const validContract = contract!;

      // Process the single contract to add calculated fields
      const processedContract =
        await this.contractEnrichmentService.processContract(validContract);

      // Check if contract is saved by user if a user is provided
      if (user) {
        const savedContractsMap = await this.checkContractsSavedByUser(
          user,
          [validContract.id],
          validContract.blockchain.id,
        );

        // Add isSavedByUser property
        processedContract.isSavedByUser =
          savedContractsMap[validContract.id] || false;
      }

      this.logger.log(
        `Successfully found contract ${id} for user ${user?.address || 'anonymous'}`,
      );

      // The types now match so we can safely return without casting
      return processedContract;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to find contract ${id}: ${err.message}`,
        err.stack,
      );

      // Re-throw known contract errors
      if (err.name === 'NotFoundException') {
        throw error;
      }

      // For unknown errors, throw a generic internal error
      ContractErrorHelpers.throwBidCalculationFailed();

      // This line should never be reached, but TypeScript requires it
      throw new Error('Unexpected error in findOne');
    }
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
    try {
      this.logger.log(
        `Getting suggested bids for address ${address} on blockchain ${blockchainId}`,
      );

      // Validate inputs
      if (!address || typeof address !== 'string') {
        this.logger.warn(`Invalid contract address provided: ${address}`);
        ContractErrorHelpers.throwInvalidContractAddress();
      }

      if (!blockchainId || typeof blockchainId !== 'string') {
        this.logger.warn(`Invalid blockchain ID provided: ${blockchainId}`);
        ContractErrorHelpers.throwInvalidBlockchainId();
      }

      const result =
        await this.contractBidAssessmentService.getSuggestedBidsByAddress(
          address,
          blockchainId,
        );

      this.logger.log(
        `Successfully calculated suggested bids for address ${address}`,
      );
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get suggested bids for address ${address}: ${err.message}`,
        err.stack,
      );

      // Re-throw known contract errors
      if (
        err.name === 'BadRequestException' ||
        err.name === 'ServiceUnavailableException'
      ) {
        throw error;
      }

      // For unknown errors, throw a generic internal error
      ContractErrorHelpers.throwBidCalculationFailed();
      throw new Error('Unexpected error in getSuggestedBidsByAddress');
    }
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
    try {
      this.logger.log(
        `Getting suggested bids for size ${size} bytes on blockchain ${blockchainId}`,
      );

      // Validate inputs
      if (!size || typeof size !== 'number' || size <= 0) {
        this.logger.warn(`Invalid bytecode size provided: ${size}`);
        ContractErrorHelpers.throwInvalidBytecodeSize();
      }

      if (!blockchainId || typeof blockchainId !== 'string') {
        this.logger.warn(`Invalid blockchain ID provided: ${blockchainId}`);
        ContractErrorHelpers.throwInvalidBlockchainId();
      }

      const result = await this.contractBidAssessmentService.getSuggestedBids(
        size,
        blockchainId,
      );

      this.logger.log(
        `Successfully calculated suggested bids for size ${size} bytes`,
      );
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get suggested bids for size ${size}: ${err.message}`,
        err.stack,
      );

      // Re-throw known contract errors
      if (
        err.name === 'BadRequestException' ||
        err.name === 'ServiceUnavailableException'
      ) {
        throw error;
      }

      // For unknown errors, throw a generic internal error
      ContractErrorHelpers.throwBidCalculationFailed();
      throw new Error('Unexpected error in getSuggestedBidsBySize');
    }
  }

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
    try {
      if (!contractIds.length) {
        this.logger.debug('No contract IDs provided, returning empty result');
        return {};
      }

      this.logger.debug(
        `Checking saved status for ${contractIds.length} contracts for user ${user.address}`,
      );

      // Use query builder service for user contracts query
      const queryBuilder =
        this.contractQueryBuilderService.buildUserContractsQuery(
          user,
          contractIds,
          blockchainId,
        );

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

      this.logger.debug(
        `Found ${savedContractIds.length} saved contracts out of ${contractIds.length} for user ${user.address}`,
      );

      return resultMap;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to check saved contracts for user ${user.address}: ${err.message}`,
        err.stack,
      );

      // For database errors, return empty result to avoid breaking the main flow
      this.logger.warn('Returning empty saved contracts map due to error');
      return {};
    }
  }
}
