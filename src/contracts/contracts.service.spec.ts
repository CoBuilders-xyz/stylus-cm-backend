import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import {
  ContractEnrichmentService,
  ContractBidAssessmentService,
  ContractQueryBuilderService,
} from './services';
import { User } from '../users/entities/user.entity';
import { logTestResult } from '../common/utils/test-logger.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ContractSortingDto } from './dto';
import { ContractSortField } from './dto/contract-sorting.dto';
import { SearchDto } from '../common/dto/search.dto';
import { SortDirection } from '../common/dto/sort.dto';

// TESTING CONFIGURATION

// Mock interfaces for type safety
interface MockContractRepository {
  findOne: jest.Mock;
  find: jest.Mock;
  createQueryBuilder: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

interface MockContractEnrichmentService {
  processContract: jest.Mock;
  processContracts: jest.Mock;
}

interface MockContractBidAssessmentService {
  calculateSuggestedBids: jest.Mock;
  getSuggestedBids: jest.Mock;
  getSuggestedBidsByAddress: jest.Mock;
}

interface MockContractQueryBuilderService {
  buildFindAllQuery: jest.Mock;
  buildUserContractsQuery: jest.Mock;
}

describe('ContractsService', () => {
  let service: ContractsService;
  let mockContractRepository: MockContractRepository;
  let mockContractEnrichmentService: MockContractEnrichmentService;
  let mockContractBidAssessmentService: MockContractBidAssessmentService;
  let mockContractQueryBuilderService: MockContractQueryBuilderService;

  // Test data factory
  const createMockContract = (overrides = {}) => ({
    id: 'test-contract-id',
    address: '0x1234567890123456789012345678901234567890',
    deployedAt: new Date('2024-01-01'),
    size: 1024,
    bytecode: {
      id: 'bytecode-id',
      data: '0x608060405234801561001057600080fd5b50',
      size: 1024,
    },
    blockchain: {
      id: 'arbitrum-sepolia',
      name: 'Arbitrum Sepolia',
      chainId: 421614,
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
      blockExplorerUrl: 'https://sepolia.arbiscan.io',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  const createMockUser = (overrides = {}): User =>
    ({
      id: 'test-user-uuid',
      address: '0x9876543210987654321098765432109876543210',
      name: 'Test User',
      isActive: true,
      alertsSettings: {},
      ...overrides,
    }) as User;

  const createMockProcessedContract = (overrides = {}) => ({
    ...createMockContract(),
    suggestedBid: 10.5,
    estimatedGas: 21000,
    deploymentCost: 0.01,
    isSavedByUser: false,
    ...overrides,
  });

  beforeEach(async () => {
    // Create mocks for all dependencies
    mockContractRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockContractEnrichmentService = {
      processContract: jest.fn(),
      processContracts: jest.fn(),
    };

    mockContractBidAssessmentService = {
      calculateSuggestedBids: jest.fn(),
      getSuggestedBids: jest.fn(),
      getSuggestedBidsByAddress: jest.fn(),
    };

    mockContractQueryBuilderService = {
      buildFindAllQuery: jest.fn(),
      buildUserContractsQuery: jest.fn().mockReturnValue({
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
        {
          provide: ContractEnrichmentService,
          useValue: mockContractEnrichmentService,
        },
        {
          provide: ContractBidAssessmentService,
          useValue: mockContractBidAssessmentService,
        },
        {
          provide: ContractQueryBuilderService,
          useValue: mockContractQueryBuilderService,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  // BASIC SERVICE TESTS
  describe('Basic Service Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();

      logTestResult(
        'SERVICE INITIALIZATION TEST',
        {
          testType: 'Basic service setup validation',
          dependencies: [
            'ContractRepository',
            'ContractEnrichmentService',
            'ContractBidAssessmentService',
            'ContractQueryBuilderService',
          ],
        },
        { serviceExists: service !== undefined, testPassed: true },
      );
    });
  });

  // FIND ONE CONTRACT TESTS (SIMPLEST CASE)
  describe('findOne - Simple Contract Retrieval', () => {
    it('should find and return a contract successfully', async () => {
      // Arrange
      const testContractId = 'test-contract-id';
      const mockContract = createMockContract();
      const mockProcessedContract = createMockProcessedContract();
      const mockUser = createMockUser();

      // Setup mocks
      mockContractRepository.findOne.mockResolvedValue(mockContract);
      mockContractEnrichmentService.processContract.mockResolvedValue(
        mockProcessedContract,
      );

      // Act
      const result = await service.findOne(testContractId, mockUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(testContractId);
      expect(result.address).toBe(mockContract.address);
      expect(mockContractRepository.findOne).toHaveBeenCalledWith({
        where: { id: testContractId },
        relations: ['bytecode', 'blockchain'],
      });
      expect(
        mockContractEnrichmentService.processContract,
      ).toHaveBeenCalledWith(mockContract);
      expect(mockContractRepository.findOne).toHaveBeenCalledTimes(1);
      expect(
        mockContractEnrichmentService.processContract,
      ).toHaveBeenCalledTimes(1);

      logTestResult(
        'FIND ONE CONTRACT - SUCCESS CASE',
        {
          inputContractId: testContractId,
          mockContract: {
            id: mockContract.id,
            address: mockContract.address,
            size: mockContract.size,
          },
          mockUser: {
            id: mockUser.id,
            address: mockUser.address,
          },
          repositoryCallCount: mockContractRepository.findOne.mock.calls.length,
          enrichmentCallCount:
            mockContractEnrichmentService.processContract.mock.calls.length,
        },
        {
          testPassed: true,
          contractFound: true,
          resultId: result.id,
          resultAddress: result.address,
        },
      );
    });

    it('should find contract without user context', async () => {
      // Arrange
      const testContractId = 'test-contract-id';
      const mockContract = createMockContract();
      const mockProcessedContract = createMockProcessedContract();

      // Setup mocks
      mockContractRepository.findOne.mockResolvedValue(mockContract);
      mockContractEnrichmentService.processContract.mockResolvedValue(
        mockProcessedContract,
      );

      // Act
      const result = await service.findOne(testContractId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(testContractId);
      expect(mockContractRepository.findOne).toHaveBeenCalledWith({
        where: { id: testContractId },
        relations: ['bytecode', 'blockchain'],
      });
      expect(
        mockContractEnrichmentService.processContract,
      ).toHaveBeenCalledWith(mockContract);

      logTestResult(
        'FIND ONE CONTRACT - NO USER CONTEXT',
        {
          inputContractId: testContractId,
          userProvided: false,
          mockContract: {
            id: mockContract.id,
            address: mockContract.address,
          },
        },
        {
          testPassed: true,
          contractFound: true,
          resultId: result.id,
        },
      );
    });
  });

  // FIND ALL CONTRACTS TESTS
  describe('findAll - Contract Listing', () => {
    it('should find and return paginated contracts successfully', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockBlockchainId = 'arbitrum-sepolia';
      const mockPaginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockSortingDto: ContractSortingDto = {
        sortBy: [ContractSortField.LAST_BID],
        sortDirection: [SortDirection.DESC],
      };
      const mockSearchDto: SearchDto = { search: '' };

      const mockContracts = [
        createMockContract({ id: 'contract-1' }),
        createMockContract({ id: 'contract-2' }),
      ];
      const mockProcessedContracts = [
        createMockProcessedContract({ id: 'contract-1' }),
        createMockProcessedContract({ id: 'contract-2' }),
      ];

      // Setup query builder mock
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockContracts, 2]),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockContractQueryBuilderService.buildFindAllQuery.mockReturnValue(
        mockQueryBuilder,
      );
      mockContractQueryBuilderService.buildUserContractsQuery.mockReturnValue(
        mockQueryBuilder,
      );
      mockContractEnrichmentService.processContracts.mockResolvedValue(
        mockProcessedContracts,
      );

      // Act
      const result = await service.findAll(
        mockUser,
        mockBlockchainId,
        mockPaginationDto,
        mockSortingDto,
        mockSearchDto,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
      expect(
        mockContractQueryBuilderService.buildFindAllQuery,
      ).toHaveBeenCalled();
      expect(
        mockContractEnrichmentService.processContracts,
      ).toHaveBeenCalledWith(mockContracts);

      logTestResult(
        'FIND ALL CONTRACTS - SUCCESS CASE',
        {
          contractCount: mockContracts.length,
          resultCount: result.data.length,
          totalItems: result.meta.totalItems,
        },
        {
          testPassed: true,
          contractsFound: true,
        },
      );
    });
  });

  // SUGGESTED BIDS TESTS
  describe('getSuggestedBidsByAddress - Bid Recommendations', () => {
    it('should return suggested bids for a contract address', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testBlockchainId = 'arbitrum-sepolia';
      const mockSuggestedBids = {
        suggestedBids: {
          highRisk: '1000',
          midRisk: '2000',
          lowRisk: '3000',
        },
        cacheStats: {
          utilization: 0.75,
          evictionRate: 0.1,
          medianBidPerByte: '100',
          competitiveness: 0.5,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '750000',
          minBid: '1000',
        },
      };

      mockContractBidAssessmentService.getSuggestedBidsByAddress.mockResolvedValue(
        mockSuggestedBids,
      );

      // Act
      const result = await service.getSuggestedBidsByAddress(
        testAddress,
        testBlockchainId,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.suggestedBids).toBeDefined();
      expect(result.cacheStats).toBeDefined();
      expect(
        mockContractBidAssessmentService.getSuggestedBidsByAddress,
      ).toHaveBeenCalledWith(testAddress, testBlockchainId);

      logTestResult(
        'SUGGESTED BIDS BY ADDRESS - SUCCESS CASE',
        {
          address: testAddress,
          blockchainId: testBlockchainId,
          highRiskBid: result.suggestedBids.highRisk,
          midRiskBid: result.suggestedBids.midRisk,
          lowRiskBid: result.suggestedBids.lowRisk,
        },
        {
          testPassed: true,
          bidsCalculated: true,
        },
      );
    });
  });

  describe('getSuggestedBidsBySize - Bid Recommendations by Size', () => {
    it('should return suggested bids for a given size', async () => {
      // Arrange
      const testSize = 1024;
      const testBlockchainId = 'arbitrum-sepolia';
      const mockSuggestedBids = {
        suggestedBids: {
          highRisk: '500',
          midRisk: '1000',
          lowRisk: '1500',
        },
        cacheStats: {
          utilization: 0.65,
          evictionRate: 0.05,
          medianBidPerByte: '50',
          competitiveness: 0.3,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '650000',
          minBid: '500',
        },
      };

      mockContractBidAssessmentService.getSuggestedBids.mockResolvedValue(
        mockSuggestedBids,
      );

      // Act
      const result = await service.getSuggestedBidsBySize(
        testSize,
        testBlockchainId,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.suggestedBids).toBeDefined();
      expect(result.cacheStats).toBeDefined();
      expect(
        mockContractBidAssessmentService.getSuggestedBids,
      ).toHaveBeenCalledWith(testSize, testBlockchainId);

      logTestResult(
        'SUGGESTED BIDS BY SIZE - SUCCESS CASE',
        {
          size: testSize,
          blockchainId: testBlockchainId,
          highRiskBid: result.suggestedBids.highRisk,
          midRiskBid: result.suggestedBids.midRisk,
          lowRiskBid: result.suggestedBids.lowRisk,
        },
        {
          testPassed: true,
          bidsCalculated: true,
        },
      );
    });
  });
});
