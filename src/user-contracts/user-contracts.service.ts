import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContract } from '../user-contracts/entities/user-contract.entity';
import { User } from 'src/users/entities/user.entity';
import { ethers } from 'ethers';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  ContractSortingDto,
  ContractSortFieldNumeric,
} from 'src/contracts/dto/contract-sorting.dto';
import { SearchDto } from 'src/common/dto/search.dto';
import { SortDirection } from 'src/common/dto/sort.dto';
import { ContractsUtilsService } from 'src/contracts/contracts.utils.service';
import { UpdateUserContractNameDto } from './dto/update-user-contract-name.dto';
import { AlertsService } from 'src/alerts/alerts.service';
import { Bytecode } from 'src/contracts/entities/bytecode.entity';
import { ContractType, ProviderManager } from 'src/common/utils/provider.util';

@Injectable()
export class UserContractsService {
  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Bytecode)
    private bytecodeRepository: Repository<Bytecode>,
    private readonly contractsUtilsService: ContractsUtilsService,
    private readonly alertsService: AlertsService,
    private readonly providerManager: ProviderManager,
  ) {}

  async createUserContract(
    user: User,
    address: string,
    blockchainId: string,
    name?: string,
  ) {
    const userContract = await this.userContractRepository.findOne({
      where: {
        address,
        blockchain: { id: blockchainId },
        user: { id: user.id },
      },
    });

    if (userContract) {
      throw new BadRequestException('User contract already exists');
    }

    const blockchain = await this.blockchainRepository.findOne({
      where: { id: blockchainId },
    });

    if (!blockchain) {
      throw new BadRequestException('Blockchain not found');
    }

    const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl);
    const onChainBytecode = await provider.getCode(address);
    if (onChainBytecode === '0x' || onChainBytecode === '') {
      throw new BadRequestException(
        'The provided address is not a smart contract on the selected blockchain',
      );
    }
    const verifiedAddress = ethers.getAddress(address);
    const nonEmptyName = name || verifiedAddress;

    let contract = await this.contractRepository.findOne({
      where: { blockchain, address: verifiedAddress },
    });

    let bytecode = await this.bytecodeRepository.findOne({
      where: {
        blockchain,
        bytecodeHash: ethers.keccak256(onChainBytecode),
      },
    });
    if (!bytecode) {
      const arbWasmContract = this.providerManager.getContract(
        blockchain,
        ContractType.ARB_WASM,
      );
      const contractSizeRaw = (await arbWasmContract.codehashAsmSize(
        ethers.keccak256(onChainBytecode),
      )) as bigint;
      const contractSize = contractSizeRaw.toString();

      bytecode = this.bytecodeRepository.create({
        blockchain,
        bytecodeHash: ethers.keccak256(onChainBytecode),
        size: contractSize,
        lastBid: '0',
        bidPlusDecay: '0',
        lastEvictionBid: '0',
        isCached: false,
        totalBidInvestment: '0',
      });
      bytecode = await this.bytecodeRepository.save(bytecode);
    }

    if (!contract) {
      contract = this.contractRepository.create({
        blockchain,
        address: verifiedAddress,
        bytecode: bytecode,
        lastBid: '0',
        bidPlusDecay: '0',
        totalBidInvestment: '0',
        isAutomated: false,
        maxBid: '0',
      });
      contract = await this.contractRepository.save(contract);
    }

    const newUserContract = this.userContractRepository.create({
      address,
      blockchain,
      contract,
      user,
      name: nonEmptyName,
    });

    return this.userContractRepository.save(newUserContract);
  }

  async getUserContracts(
    user: User,
    blockchainId: string,
    paginationDto: PaginationDto,
    sortingDto: ContractSortingDto,
    searchDto: SearchDto,
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Create query builder
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
      queryBuilder.andWhere(
        '(LOWER(userContract.address) LIKE LOWER(:search) OR LOWER(userContract.name) LIKE LOWER(:search))',
        {
          search: `%${searchDto.search}%`,
        },
      );
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
    const [userContracts, totalItems] = await queryBuilder.getManyAndCount();

    // Process contracts that have an associated contract
    const processedUserContracts = await Promise.all(
      userContracts.map(async (userContract) => {
        // Get alerts for this user contract
        const alerts = await this.alertsService.getAlertsForUserContract(
          user.id,
          userContract.id,
        );

        // If the userContract has an associated contract, process it
        if (userContract.contract) {
          const processedContract =
            await this.contractsUtilsService.processContract(
              userContract.contract,
            );

          return {
            ...userContract,
            contract: processedContract,
            alerts,
          };
        }
        return {
          ...userContract,
          alerts,
        };
      }),
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: processedUserContracts,
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

  async getUserContract(user: User, id: string) {
    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
      relations: [
        'contract',
        'contract.bytecode',
        'blockchain',
        'contract.blockchain',
      ],
    });

    if (!userContract) {
      throw new NotFoundException('User contract not found');
    }

    // Get alerts for this user contract
    const alerts = await this.alertsService.getAlertsForUserContract(
      user.id,
      id,
    );

    // If the userContract has an associated contract, process it
    if (userContract.contract) {
      const processedContract =
        await this.contractsUtilsService.processContract(
          userContract.contract,
          true,
        );

      return {
        ...userContract,
        contract: processedContract,
        alerts,
      };
    }

    return {
      ...userContract,
      alerts,
    };
  }

  async updateUserContractName(
    user: User,
    id: string,
    updateNameDto: UpdateUserContractNameDto,
  ) {
    // Find the user contract, ensuring it belongs to the authenticated user
    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
      relations: [
        'contract',
        'contract.bytecode',
        'blockchain',
        'contract.blockchain',
      ],
    });

    if (!userContract) {
      throw new NotFoundException('User contract not found');
    }

    // Update the name
    userContract.name = updateNameDto.name;

    // Save the updated user contract
    await this.userContractRepository.save(userContract);

    return userContract;
  }

  async deleteUserContract(user: User, id: string): Promise<void> {
    // Find the user contract, ensuring it belongs to the authenticated user
    const userContract = await this.userContractRepository.findOne({
      where: { id, user },
    });

    if (!userContract) {
      throw new NotFoundException('User contract not found');
    }

    // Delete the user contract
    await this.userContractRepository.remove(userContract);
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
}
