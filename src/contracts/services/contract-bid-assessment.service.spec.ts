import { Test, TestingModule } from '@nestjs/testing';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { CacheStatisticsService } from './cache-statistics.service';
import { Contract } from '../entities/contract.entity';

describe('ContractBidAssessmentService', () => {
  let service: ContractBidAssessmentService;
  let mockContractBidCalculatorService: {
    getCacheManagerContract: jest.Mock;
  };
  let mockCacheStatisticsService: {
    getCacheStatistics: jest.Mock;
    calculatePercentage: jest.Mock;
  };

  beforeEach(async () => {
    // Create service mocks
    mockContractBidCalculatorService = {
      getCacheManagerContract: jest.fn(),
    };

    mockCacheStatisticsService = {
      getCacheStatistics: jest.fn(),
      calculatePercentage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractBidAssessmentService,
        {
          provide: ContractBidCalculatorService,
          useValue: mockContractBidCalculatorService,
        },
        {
          provide: CacheStatisticsService,
          useValue: mockCacheStatisticsService,
        },
      ],
    }).compile();

    service = module.get<ContractBidAssessmentService>(
      ContractBidAssessmentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSuggestedBids', () => {
    it('should calculate suggested bids by size successfully', async () => {
      // Arrange
      const size = 1024;
      const blockchainId = 'test-blockchain-id';

      const mockCacheManagerContract = {
        'getMinBid(uint64)': jest.fn().mockResolvedValue(BigInt(1000)),
      };

      const mockCacheStats = {
        utilization: 0.7,
        evictionRate: 0.08,
        medianBidPerByte: '80',
        competitiveness: 0.4,
        cacheSizeBytes: '1000000',
        usedCacheSizeBytes: '700000',
        minBid: '1000',
      };

      mockContractBidCalculatorService.getCacheManagerContract.mockResolvedValue(
        mockCacheManagerContract,
      );
      mockCacheStatisticsService.getCacheStatistics.mockResolvedValue(
        mockCacheStats,
      );

      // Act
      const result = await service.getSuggestedBids(size, blockchainId);

      // Assert
      expect(result).toBeDefined();
      expect(result.suggestedBids).toBeDefined();
      expect(result.suggestedBids.highRisk).toBe('1000'); // Should be minBid
      expect(result.suggestedBids.midRisk).toBeDefined();
      expect(result.suggestedBids.lowRisk).toBeDefined();
      expect(result.cacheStats).toEqual(mockCacheStats);

      // Verify method calls
      expect(
        mockCacheManagerContract['getMinBid(uint64)'],
      ).toHaveBeenCalledWith(size);
      expect(
        mockCacheStatisticsService.getCacheStatistics,
      ).toHaveBeenCalledWith(blockchainId, '1000');
    });
  });

  describe('getSuggestedBidsByAddress', () => {
    it('should calculate suggested bids by address successfully', async () => {
      // Arrange
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'test-blockchain-id';

      const mockCacheManagerContract = {
        'getMinBid(address)': jest.fn().mockResolvedValue(BigInt(1200)),
      };

      const mockCacheStats = {
        utilization: 0.65,
        evictionRate: 0.06,
        medianBidPerByte: '90',
        competitiveness: 0.35,
        cacheSizeBytes: '1000000',
        usedCacheSizeBytes: '650000',
        minBid: '1200',
      };

      mockContractBidCalculatorService.getCacheManagerContract.mockResolvedValue(
        mockCacheManagerContract,
      );
      mockCacheStatisticsService.getCacheStatistics.mockResolvedValue(
        mockCacheStats,
      );

      // Act
      const result = await service.getSuggestedBidsByAddress(
        address,
        blockchainId,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.suggestedBids).toBeDefined();
      expect(result.suggestedBids.highRisk).toBe('1200'); // Should be minBid
      expect(result.suggestedBids.midRisk).toBeDefined();
      expect(result.suggestedBids.lowRisk).toBeDefined();
      expect(result.cacheStats).toEqual(mockCacheStats);

      // Verify method calls
      expect(
        mockCacheManagerContract['getMinBid(address)'],
      ).toHaveBeenCalledWith(address);
      expect(
        mockCacheStatisticsService.getCacheStatistics,
      ).toHaveBeenCalledWith(blockchainId, '1200');
    });
  });

  describe('calculateEvictionRisk', () => {
    it('should calculate eviction risk for a cached contract', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: {
          lastBid: '2000000',
          size: '1024',
          bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
          isCached: true,
        },
      } as unknown as Contract;

      const mockCacheManagerContract = {
        decay: jest.fn().mockResolvedValue(BigInt(100)),
      };

      const mockSuggestedBids = {
        suggestedBids: {
          highRisk: '1000000',
          midRisk: '1500000',
          lowRisk: '2000000',
        },
        cacheStats: {
          utilization: 0.8,
          evictionRate: 0.12,
          medianBidPerByte: '120',
          competitiveness: 0.6,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '800000',
          minBid: '1000000',
        },
      };

      mockContractBidCalculatorService.getCacheManagerContract.mockResolvedValue(
        mockCacheManagerContract,
      );

      // Mock getSuggestedBids method
      const getSuggestedBidsSpy = jest
        .spyOn(service, 'getSuggestedBids')
        .mockResolvedValue(mockSuggestedBids);

      mockCacheStatisticsService.calculatePercentage.mockReturnValue(75);

      // Act
      const result = await service.calculateEvictionRisk(mockContract);

      // Assert
      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.riskLevel);
      expect(result.remainingEffectiveBid).toBeDefined();
      expect(result.suggestedBids).toEqual(mockSuggestedBids.suggestedBids);
      expect(result.cacheStats).toEqual(mockSuggestedBids.cacheStats);
      expect(result.comparisonPercentages).toBeDefined();

      // Verify method calls
      expect(mockCacheManagerContract.decay).toHaveBeenCalled();
      expect(getSuggestedBidsSpy).toHaveBeenCalledWith(
        1024,
        'test-blockchain-id',
      );

      // Cleanup
      getSuggestedBidsSpy.mockRestore();
    });

    it('should throw error when contract has no bytecode', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: null,
      } as unknown as Contract;

      // Act & Assert
      await expect(
        service.calculateEvictionRisk(mockContract),
      ).rejects.toThrow();
    });
  });
});
