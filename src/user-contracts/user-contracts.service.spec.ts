import { Test, TestingModule } from '@nestjs/testing';
import { UserContractsService } from './user-contracts.service';
import {
  UserContractCrudService,
  UserContractValidationService,
  UserContractEnrichmentService,
  UserContractEntityService,
} from './services';
import { User } from '../users/entities/user.entity';
import { UserContract } from './entities/user-contract.entity';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ContractSortingDto } from '../contracts/dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { UpdateUserContractNameDto } from './dto/update-user-contract-name.dto';

describe('UserContractsService', () => {
  let service: UserContractsService;
  let mockCrudService: {
    createUserContract: jest.Mock;
    getUserContracts: jest.Mock;
    getUserContract: jest.Mock;
    updateUserContractName: jest.Mock;
    deleteUserContract: jest.Mock;
    checkContractsSavedByUser: jest.Mock;
  };
  let mockValidationService: {
    validateUserContractCreation: jest.Mock;
    validateContractOnBlockchain: jest.Mock;
  };
  let mockEnrichmentService: {
    enrichUserContract: jest.Mock;
    enrichUserContracts: jest.Mock;
    createPaginationResponse: jest.Mock;
  };
  let mockEntityService: {
    getOrCreateContract: jest.Mock;
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
      rpcUrl: 'https://test-rpc.com',
    }) as unknown as Blockchain;

  const createMockContract = (): Contract =>
    ({
      id: 'contract-123',
      address: '0x1234567890123456789012345678901234567890',
      blockchain: createMockBlockchain(),
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

  beforeEach(async () => {
    mockCrudService = {
      createUserContract: jest.fn(),
      getUserContracts: jest.fn(),
      getUserContract: jest.fn(),
      updateUserContractName: jest.fn(),
      deleteUserContract: jest.fn(),
      checkContractsSavedByUser: jest.fn(),
    };

    mockValidationService = {
      validateUserContractCreation: jest.fn(),
      validateContractOnBlockchain: jest.fn(),
    };

    mockEnrichmentService = {
      enrichUserContract: jest.fn(),
      enrichUserContracts: jest.fn(),
      createPaginationResponse: jest.fn(),
    };

    mockEntityService = {
      getOrCreateContract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContractsService,
        {
          provide: UserContractCrudService,
          useValue: mockCrudService,
        },
        {
          provide: UserContractValidationService,
          useValue: mockValidationService,
        },
        {
          provide: UserContractEnrichmentService,
          useValue: mockEnrichmentService,
        },
        {
          provide: UserContractEntityService,
          useValue: mockEntityService,
        },
      ],
    }).compile();

    service = module.get<UserContractsService>(UserContractsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserContract', () => {
    it('should create user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'blockchain-123';
      const name = 'Test Contract';
      const blockchain = createMockBlockchain();
      const contract = createMockContract();
      const userContract = createMockUserContract();
      const enrichedResult = { ...userContract, enriched: true };

      mockValidationService.validateUserContractCreation.mockResolvedValue({
        blockchain,
        verifiedAddress: address,
      });
      mockValidationService.validateContractOnBlockchain.mockResolvedValue({
        onChainBytecode: '0xbytecode',
      });
      mockEntityService.getOrCreateContract.mockResolvedValue(contract);
      mockCrudService.createUserContract.mockResolvedValue(userContract);
      mockEnrichmentService.enrichUserContract.mockReturnValue(enrichedResult);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await service.createUserContract(
        user,
        address,
        blockchainId,
        name,
      );

      // Assert
      expect(
        mockValidationService.validateUserContractCreation,
      ).toHaveBeenCalledWith(user, address, blockchainId);
      expect(
        mockValidationService.validateContractOnBlockchain,
      ).toHaveBeenCalledWith(address, blockchain);
      expect(mockEntityService.getOrCreateContract).toHaveBeenCalledWith(
        address,
        blockchain,
        '0xbytecode',
      );
      expect(mockCrudService.createUserContract).toHaveBeenCalledWith(
        user,
        address,
        blockchain,
        contract,
        name,
      );
      expect(mockEnrichmentService.enrichUserContract).toHaveBeenCalledWith(
        userContract,
        user,
      );
      expect(result).toBe(enrichedResult);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'blockchain-123';
      const error = new Error('Validation failed');

      mockValidationService.validateUserContractCreation.mockRejectedValue(
        error,
      );

      // Act & Assert
      await expect(
        service.createUserContract(user, address, blockchainId),
      ).rejects.toThrow('Validation failed');
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
      const enrichedContracts = [{ ...userContracts[0], enriched: true }];
      const paginationResponse = {
        data: enrichedContracts,
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
      };

      mockCrudService.getUserContracts.mockResolvedValue({
        data: userContracts,
        total: 1,
      });
      mockEnrichmentService.enrichUserContracts.mockResolvedValue(
        enrichedContracts,
      );
      mockEnrichmentService.createPaginationResponse.mockReturnValue(
        paginationResponse,
      );

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await service.getUserContracts(
        user,
        blockchainId,
        paginationDto,
        sortingDto,
        searchDto,
      );

      // Assert
      expect(mockCrudService.getUserContracts).toHaveBeenCalledWith(
        user,
        blockchainId,
        paginationDto,
        sortingDto,
        searchDto,
      );
      expect(mockEnrichmentService.enrichUserContracts).toHaveBeenCalledWith(
        userContracts,
        user,
      );
      expect(
        mockEnrichmentService.createPaginationResponse,
      ).toHaveBeenCalledWith(enrichedContracts, 1, 10, 1);
      expect(result).toEqual(paginationResponse);
    });
  });

  describe('getUserContract', () => {
    it('should get single user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';
      const userContract = createMockUserContract();
      const enrichedResult = { ...userContract, enriched: true };

      mockCrudService.getUserContract.mockResolvedValue(userContract);
      mockEnrichmentService.enrichUserContract.mockReturnValue(enrichedResult);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await service.getUserContract(user, id);

      // Assert
      expect(mockCrudService.getUserContract).toHaveBeenCalledWith(user, id);
      expect(mockEnrichmentService.enrichUserContract).toHaveBeenCalledWith(
        userContract,
        user,
        true,
      );
      expect(result).toBe(enrichedResult);
    });
  });

  describe('updateUserContractName', () => {
    it('should update user contract name successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';
      const updateNameDto: UpdateUserContractNameDto = { name: 'New Name' };
      const updatedContract = createMockUserContract();

      mockCrudService.updateUserContractName.mockResolvedValue(updatedContract);

      // Act
      const result = await service.updateUserContractName(
        user,
        id,
        updateNameDto,
      );

      // Assert
      expect(mockCrudService.updateUserContractName).toHaveBeenCalledWith(
        user,
        id,
        updateNameDto,
      );
      expect(result).toBe(updatedContract);
    });
  });

  describe('deleteUserContract', () => {
    it('should delete user contract successfully', async () => {
      // Arrange
      const user = createMockUser();
      const id = 'user-contract-123';

      mockCrudService.deleteUserContract.mockResolvedValue(undefined);

      // Act
      await service.deleteUserContract(user, id);

      // Assert
      expect(mockCrudService.deleteUserContract).toHaveBeenCalledWith(user, id);
    });
  });

  describe('checkContractsSavedByUser', () => {
    it('should check contracts saved by user successfully', async () => {
      // Arrange
      const user = createMockUser();
      const contractIds = ['contract-1', 'contract-2'];
      const blockchainId = 'blockchain-123';
      const expectedResult = { 'contract-1': true, 'contract-2': false };

      mockCrudService.checkContractsSavedByUser.mockResolvedValue(
        expectedResult,
      );

      // Act
      const result = await service.checkContractsSavedByUser(
        user,
        contractIds,
        blockchainId,
      );

      // Assert
      expect(mockCrudService.checkContractsSavedByUser).toHaveBeenCalledWith(
        user,
        contractIds,
        blockchainId,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
