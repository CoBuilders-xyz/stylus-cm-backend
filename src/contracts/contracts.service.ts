import { Injectable } from '@nestjs/common';
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
import { UserContract } from '../user-contracts/entities/user-contract.entity';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(UserContract)
    private readonly userContractRepository: Repository<UserContract>,
    private readonly contractEnrichmentService: ContractEnrichmentService,
    private readonly contractBidAssessmentService: ContractBidAssessmentService,
    private readonly contractQueryBuilderService: ContractQueryBuilderService,
  ) {}

  async findAll(
    user: User,
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ): Promise<PaginationResponse<ContractResponse>> {
    const { page = 1, limit = 10 } = paginationDto;

    // Use query builder service for complex query logic
    const queryBuilder = this.contractQueryBuilderService.buildFindAllQuery(
      blockchainId,
      paginationDto,
      sortingDto,
      searchDto,
    );

    // Execute query
    const [contracts, totalItems] = await queryBuilder.getManyAndCount();

    // Process contracts to add calculated fields
    const processedContracts =
      await this.contractEnrichmentService.processContracts(contracts);

    // Get contract IDs to check if they're saved by the user
    const contractIds = contracts.map((contract) => contract.id);

    // Check which contracts are saved by the user using query builder service
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
      await this.contractEnrichmentService.processContract(contract);

    // Check if contract is saved by user if a user is provided
    if (user) {
      const savedContractsMap = await this.checkContractsSavedByUser(
        user,
        [contract.id],
        contract.blockchain.id,
      );

      // Add isSavedByUser property
      processedContract.isSavedByUser = savedContractsMap[contract.id] || false;
    }

    // The types now match so we can safely return without casting
    return processedContract;
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
    return this.contractBidAssessmentService.getSuggestedBidsByAddress(
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
    return this.contractBidAssessmentService.getSuggestedBids(
      size,
      blockchainId,
    );
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
    if (!contractIds.length) {
      return {};
    }

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

    return resultMap;
  }
}
