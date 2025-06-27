import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CacheStatisticsService } from './cache-statistics.service';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';

describe('CacheStatisticsService', () => {
  let service: CacheStatisticsService;
  let mockBlockchainEventRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let mockContractBidCalculatorService: {
    getCacheManagerContract: jest.Mock;
  };

  beforeEach(async () => {
    // Create repository mock
    mockBlockchainEventRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    // Create service mock
    mockContractBidCalculatorService = {
      getCacheManagerContract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStatisticsService,
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockBlockchainEventRepository,
        },
        {
          provide: ContractBidCalculatorService,
          useValue: mockContractBidCalculatorService,
        },
      ],
    }).compile();

    service = module.get<CacheStatisticsService>(CacheStatisticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCacheStatistics', () => {
    it('should get cache statistics successfully', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const minBid = '1000';

      const mockCacheManagerContract = {
        cacheSize: jest.fn().mockResolvedValue(BigInt(1000000)),
        queueSize: jest.fn().mockResolvedValue(BigInt(750000)),
        getEntries: jest.fn().mockResolvedValue([
          { bid: BigInt(2000), size: BigInt(1000) },
          { bid: BigInt(3000), size: BigInt(1500) },
          { bid: BigInt(1000), size: BigInt(500) },
        ]),
      };

      mockContractBidCalculatorService.getCacheManagerContract.mockResolvedValue(
        mockCacheManagerContract,
      );

      // Mock the repository to return empty results (no recent evictions)
      mockBlockchainEventRepository.findOne.mockResolvedValue(null);
      mockBlockchainEventRepository.find.mockResolvedValue([]); // Mock eviction events

      // Act
      const result = await service.getCacheStatistics(blockchainId, minBid);

      // Assert
      expect(result).toBeDefined();
      expect(result.utilization).toBe(0.75); // 750000 / 1000000
      expect(result.cacheSizeBytes).toBe('1000000');
      expect(result.usedCacheSizeBytes).toBe('750000');
      expect(result.minBid).toBe(minBid);
      expect(result.medianBidPerByte).toBeDefined();
      expect(result.competitiveness).toBeDefined();
      expect(typeof result.evictionRate).toBe('number');

      // Verify method calls
      expect(mockCacheManagerContract.cacheSize).toHaveBeenCalled();
      expect(mockCacheManagerContract.queueSize).toHaveBeenCalled();
      expect(mockCacheManagerContract.getEntries).toHaveBeenCalled();
    });

    it('should handle empty cache entries', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const minBid = '500';

      const mockCacheManagerContract = {
        cacheSize: jest.fn().mockResolvedValue(BigInt(1000000)),
        queueSize: jest.fn().mockResolvedValue(BigInt(0)),
        getEntries: jest.fn().mockResolvedValue([]),
      };

      mockContractBidCalculatorService.getCacheManagerContract.mockResolvedValue(
        mockCacheManagerContract,
      );

      mockBlockchainEventRepository.findOne.mockResolvedValue(null);
      mockBlockchainEventRepository.find.mockResolvedValue([]); // Mock eviction events

      // Act
      const result = await service.getCacheStatistics(blockchainId, minBid);

      // Assert
      expect(result).toBeDefined();
      expect(result.utilization).toBe(0.0); // 0 / 1000000
      expect(result.medianBidPerByte).toBe('0'); // No entries = 0
      expect(result.competitiveness).toBe(0.0);
    });

    it('should throw error for invalid blockchain ID', async () => {
      // Arrange
      const invalidBlockchainId = '';

      // Act & Assert
      await expect(
        service.getCacheStatistics(invalidBlockchainId),
      ).rejects.toThrow();
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      // Arrange
      const value1 = BigInt(150);
      const value2 = BigInt(100);

      // Act
      const result = service.calculatePercentage(value1, value2);

      // Assert
      expect(result).toBe(150); // 150/100 * 100 = 150%
    });

    it('should handle zero denominator', () => {
      // Arrange
      const value1 = BigInt(150);
      const value2 = BigInt(0);

      // Act
      const result = service.calculatePercentage(value1, value2);

      // Assert
      expect(result).toBe(0); // Should handle division by zero gracefully
    });

    it('should handle zero numerator', () => {
      // Arrange
      const value1 = BigInt(0);
      const value2 = BigInt(100);

      // Act
      const result = service.calculatePercentage(value1, value2);

      // Assert
      expect(result).toBe(0);
    });
  });
});
