import {
  BadRequestException,
  ForbiddenException,
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
import { ContractSortingDto } from 'src/contracts/dto/contract-sorting.dto';
import { SearchDto } from 'src/common/dto/search.dto';
import { SortDirection } from 'src/common/dto/sort.dto';
import { ContractsUtilsService } from 'src/contracts/contracts.utils.service';

@Injectable()
export class UserContractsService {
  constructor(
    @InjectRepository(UserContract)
    private userContractRepository: Repository<UserContract>,
    @InjectRepository(Blockchain)
    private blockchainRepository: Repository<Blockchain>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    private readonly contractsUtilsService: ContractsUtilsService,
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

    const provider = new ethers.JsonRpcProvider(blockchain.rpcUrl); // TODO avoid envs within code.
    const bytecode = await provider.getCode(address);
    if (bytecode === '0x' || bytecode === '') {
      throw new BadRequestException(
        'The provided address is not a smart contract on the selected blockchain',
      );
    }
    const verifiedAddress = ethers.getAddress(address);
    const nonEmptyName = name || verifiedAddress;

    const contract = await this.contractRepository.findOne({
      where: { blockchain, address: verifiedAddress },
    });

    const newUserContract = this.userContractRepository.create({
      address,
      blockchain,
      ...(contract ? { contract } : {}),
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
        if (index === 0) {
          queryBuilder.orderBy(field, direction);
        } else {
          queryBuilder.addOrderBy(field, direction);
        }
      });
    }

    // Execute query
    const [userContracts, totalItems] = await queryBuilder.getManyAndCount();

    // Process contracts that have an associated contract
    const processedUserContracts = await Promise.all(
      userContracts.map(async (userContract) => {
        // If the userContract has an associated contract, process it
        if (userContract.contract) {
          const processedContract =
            await this.contractsUtilsService.processContract(
              userContract.contract,
            );

          return {
            ...userContract,
            contract: processedContract,
          };
        }
        return userContract;
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

    // If the userContract has an associated contract, process it
    if (userContract.contract) {
      const processedContract =
        await this.contractsUtilsService.processContract(userContract.contract);

      return {
        ...userContract,
        contract: processedContract,
      };
    }

    return userContract;
  }
}
