import { Test, TestingModule } from '@nestjs/testing';
import { UserContractCrudService } from './user-contract-crud.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserContract } from '../entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Contract } from '../../contracts/entities/contract.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ContractSortingDto } from '../../contracts/dto/contract-sorting.dto';
import { SearchDto } from '../../common/dto/search.dto';
import { UpdateUserContractNameDto } from '../dto/update-user-contract-name.dto';

describe('UserContractCrudService', () => {
  let service: UserContractCrudService;
  let mockUserContractRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const createMockUser = (): User =>
    ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }) as unknown as User;

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
    }) as unknown as Blockchain;

  const createMockContract = (): Contract =>
    ({
      id: 'contract-123',
      address: '0x1234567890123456789012345678901234567890',
    }) as unknown as Contract;

  const createMockUserContract = (): UserContract =>
    ({
      id: 'user-contract-123',
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test Contract',
      user: createMockUser(),
      blockchain: createMockBlockchain(),
      contract: createMockContract(),
    }) as unknown as UserContract;

  const createMockQueryBuilder = () => ({
    createQueryBuilder: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
  });

  beforeEach(async () => {
    mockUserContractRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContractCrudService,
        {
          provide: getRepositoryToken(UserContract),
          useValue: mockUserContractRepository,
        },
      ],
    }).compile();

    service = module.get<UserContractCrudService>(UserContractCrudService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserContract', () => {
    it('should create user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchain = createMockBlockchain();
      const contract = createMockContract();
      const name = 'Test Contract';
      const userContract = createMockUserContract();

      mockUserContractRepository.findOne.mockResolvedValue(null); // No existing contract
      mockUserContractRepository.create.mockReturnValue(userContract);
      mockUserContractRepository.save.mockResolvedValue(userContract);

      // Act
      const result = await service.createUserContract(
        user,
        address,
        blockchain,
        contract,
        name,
      );

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: {
          address,
          blockchain: { id: blockchain.id },
          user: { id: user.id },
        },
      });
      expect(mockUserContractRepository.create).toHaveBeenCalledWith({
        address,
        blockchain,
        contract,
        user,
        name,
      });
      expect(mockUserContractRepository.save).toHaveBeenCalledWith(
        userContract,
      );
      expect(result).toBe(userContract);
    });

    it('should throw error if user contract already exists', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchain = createMockBlockchain();
      const contract = createMockContract();
      const existingContract = createMockUserContract();

      mockUserContractRepository.findOne.mockResolvedValue(existingContract);

      // Act & Assert
      await expect(
        service.createUserContract(user, address, blockchain, contract),
      ).rejects.toThrow();
    });
  });

  describe('getUserContracts', () => {
    it('should get user contracts successfully', async () => {
      // Arrange
      const user = createMockUser();
      const blockchainId = 'blockchain-123';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const sortingDto: ContractSortingDto = {};
      const searchDto: SearchDto = {};
      const userContracts = [createMockUserContract()];
      const mockQueryBuilder = createMockQueryBuilder();

      mockUserContractRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockQueryBuilder.getManyAndCount.mockResolvedValue([userContracts, 1]);

      // Act
      const result = await service.getUserContracts(
        user,
        blockchainId,
        paginationDto,
        sortingDto,
        searchDto,
      );

      // Assert
      expect(
        mockUserContractRepository.createQueryBuilder,
      ).toHaveBeenCalledWith('userContract');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'blockchain.id = :blockchainId',
        { blockchainId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'userContract.user = :userId',
        { userId: user.id },
      );
      expect(result).toEqual({
        data: userContracts,
        total: 1,
      });
    });
  });

  describe('getUserContract', () => {
    it('should get user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';
      const userContract = createMockUserContract();

      mockUserContractRepository.findOne.mockResolvedValue(userContract);

      // Act
      const result = await service.getUserContract(user, id);

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: { id, user },
        relations: service['defaultRelations'],
      });
      expect(result).toBe(userContract);
    });

    it('should throw error if user contract not found', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';

      mockUserContractRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserContract(user, id)).rejects.toThrow();
    });
  });

  describe('updateUserContractName', () => {
    it('should update user contract name successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';
      const updateNameDto: UpdateUserContractNameDto = { name: 'New Name' };
      const userContract = createMockUserContract();
      const updatedContract = { ...userContract, name: 'New Name' };

      mockUserContractRepository.findOne.mockResolvedValue(userContract);
      mockUserContractRepository.save.mockResolvedValue(updatedContract);

      // Act
      const result = await service.updateUserContractName(
        user,
        id,
        updateNameDto,
      );

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: { id, user },
        relations: service['defaultRelations'],
      });
      expect(userContract.name).toBe('New Name');
      expect(mockUserContractRepository.save).toHaveBeenCalledWith(
        userContract,
      );
      expect(result).toBe(updatedContract);
    });
  });

  describe('deleteUserContract', () => {
    it('should delete user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';
      const userContract = createMockUserContract();

      mockUserContractRepository.findOne.mockResolvedValue(userContract);
      mockUserContractRepository.remove.mockResolvedValue(undefined);

      // Act
      await service.deleteUserContract(user, id);

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: { id, user },
      });
      expect(mockUserContractRepository.remove).toHaveBeenCalledWith(
        userContract,
      );
    });
  });

  describe('checkContractsSavedByUser', () => {
    it('should check contracts saved by user successfully', async () => {
      // Arrange
      const user = createMockUser();
      const contractIds = ['contract-1', 'contract-2'];
      const mockQueryBuilder = createMockQueryBuilder();
      const savedResults = [{ contractId: 'contract-1' }];

      mockUserContractRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockQueryBuilder.getRawMany.mockResolvedValue(savedResults);

      // Act
      const result = await service.checkContractsSavedByUser(user, contractIds);

      // Assert
      expect(
        mockUserContractRepository.createQueryBuilder,
      ).toHaveBeenCalledWith('userContract');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'userContract.user = :userId',
        { userId: user.id },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'contract.id IN (:...contractIds)',
        { contractIds },
      );
      expect(result).toEqual({
        'contract-1': true,
        'contract-2': false,
      });
    });

    it('should return empty object for empty contract IDs', async () => {
      // Arrange
      const user = createMockUser();
      const contractIds: string[] = [];

      // Act
      const result = await service.checkContractsSavedByUser(user, contractIds);

      // Assert
      expect(result).toEqual({});
    });
  });
});
