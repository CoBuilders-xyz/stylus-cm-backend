import { Test, TestingModule } from '@nestjs/testing';
import { ContractEnrichmentService } from './contract-enrichment.service';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractHistoryService } from './contract-history.service';
import { Contract } from '../entities/contract.entity';

describe('ContractEnrichmentService', () => {
  let service: ContractEnrichmentService;
  let mockContractBidCalculatorService: {
    calculateCurrentContractEffectiveBid: jest.Mock;
  };
  let mockContractBidAssessmentService: {
    calculateEvictionRisk: jest.Mock;
    getSuggestedBids: jest.Mock;
  };
  let mockContractHistoryService: {
    getBiddingHistory: jest.Mock;
  };

  beforeEach(async () => {
    // Create service mocks
    mockContractBidCalculatorService = {
      calculateCurrentContractEffectiveBid: jest.fn(),
    };

    mockContractBidAssessmentService = {
      calculateEvictionRisk: jest.fn(),
      getSuggestedBids: jest.fn(),
    };

    mockContractHistoryService = {
      getBiddingHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractEnrichmentService,
        {
          provide: ContractBidCalculatorService,
          useValue: mockContractBidCalculatorService,
        },
        {
          provide: ContractBidAssessmentService,
          useValue: mockContractBidAssessmentService,
        },
        {
          provide: ContractHistoryService,
          useValue: mockContractHistoryService,
        },
      ],
    }).compile();

    service = module.get<ContractEnrichmentService>(ContractEnrichmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processContract', () => {
    it('should process cached contract with effective bid and eviction risk', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id',
        address: '0x1234567890123456789012345678901234567890',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: {
          id: 'bytecode-1',
          size: '1024',
          lastBid: '2000000',
          bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
          isCached: true,
        },
      } as unknown as Contract;

      const mockEffectiveBid = '1800000';
      const mockEvictionRisk = {
        riskLevel: 'medium' as const,
        remainingEffectiveBid: '1800000',
        suggestedBids: {
          highRisk: '1000000',
          midRisk: '1500000',
          lowRisk: '2000000',
        },
        comparisonPercentages: {
          vsHighRisk: 180,
          vsMidRisk: 120,
          vsLowRisk: 90,
        },
        cacheStats: {
          utilization: 0.75,
          evictionRate: 0.1,
          medianBidPerByte: '100',
          competitiveness: 0.5,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '750000',
          minBid: '1000000',
        },
      };

      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        mockEffectiveBid,
      );
      mockContractBidAssessmentService.calculateEvictionRisk.mockResolvedValue(
        mockEvictionRisk,
      );

      // Act
      const result = await service.processContract(mockContract);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.address).toBe(mockContract.address);
      expect(result.effectiveBid).toBe(mockEffectiveBid);
      expect(result.evictionRisk).toEqual(mockEvictionRisk);
      expect(result.minBid).toBe(mockEvictionRisk.cacheStats.minBid);

      // Verify method calls
      expect(
        mockContractBidCalculatorService.calculateCurrentContractEffectiveBid,
      ).toHaveBeenCalledWith(mockContract);
      expect(
        mockContractBidAssessmentService.calculateEvictionRisk,
      ).toHaveBeenCalledWith(mockContract);

      // Should not call getBiddingHistory by default
      expect(
        mockContractHistoryService.getBiddingHistory,
      ).not.toHaveBeenCalled();
    });

    it('should process non-cached contract with suggested bids only', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id-2',
        address: '0x9876543210987654321098765432109876543210',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: {
          id: 'bytecode-2',
          size: '2048',
          lastBid: '0',
          bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
          isCached: false,
        },
      } as unknown as Contract;

      const mockSuggestedBidsResult = {
        suggestedBids: {
          highRisk: '800000',
          midRisk: '1200000',
          lowRisk: '1600000',
        },
        cacheStats: {
          utilization: 0.65,
          evictionRate: 0.05,
          medianBidPerByte: '75',
          competitiveness: 0.3,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '650000',
          minBid: '800000',
        },
      };

      mockContractBidAssessmentService.getSuggestedBids.mockResolvedValue(
        mockSuggestedBidsResult,
      );

      // Act
      const result = await service.processContract(mockContract);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.address).toBe(mockContract.address);
      expect(result.suggestedBids).toEqual({
        suggestedBids: mockSuggestedBidsResult.suggestedBids,
        cacheStats: mockSuggestedBidsResult.cacheStats,
      });
      expect(result.minBid).toBe(mockSuggestedBidsResult.cacheStats.minBid);

      // Should not have effective bid or eviction risk for non-cached contracts
      expect(result.effectiveBid).toBeUndefined();
      expect(result.evictionRisk).toBeUndefined();

      // Verify method calls
      expect(
        mockContractBidAssessmentService.getSuggestedBids,
      ).toHaveBeenCalledWith(2048, 'test-blockchain-id');

      // Should not call cached contract methods
      expect(
        mockContractBidCalculatorService.calculateCurrentContractEffectiveBid,
      ).not.toHaveBeenCalled();
      expect(
        mockContractBidAssessmentService.calculateEvictionRisk,
      ).not.toHaveBeenCalled();
    });

    it('should include bidding history when requested', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id-3',
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: {
          id: 'bytecode-3',
          size: '512',
          lastBid: '1000000',
          bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
          isCached: true,
        },
      } as unknown as Contract;

      const mockEffectiveBid = '900000';
      const mockEvictionRisk = {
        riskLevel: 'low' as const,
        remainingEffectiveBid: '900000',
        suggestedBids: {
          highRisk: '500000',
          midRisk: '750000',
          lowRisk: '1000000',
        },
        comparisonPercentages: {
          vsHighRisk: 180,
          vsMidRisk: 120,
          vsLowRisk: 90,
        },
        cacheStats: {
          utilization: 0.5,
          evictionRate: 0.02,
          medianBidPerByte: '50',
          competitiveness: 0.2,
          cacheSizeBytes: '1000000',
          usedCacheSizeBytes: '500000',
          minBid: '500000',
        },
      };

      const mockBiddingHistory = [
        {
          id: 'bid-1',
          bidAmount: '1000000',
          timestamp: new Date('2023-01-01T00:00:00Z'),
          transactionHash: '0x123',
          isAutomated: false,
        },
        {
          id: 'bid-2',
          bidAmount: '800000',
          timestamp: new Date('2022-12-15T00:00:00Z'),
          transactionHash: '0x456',
          isAutomated: true,
        },
      ];

      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        mockEffectiveBid,
      );
      mockContractBidAssessmentService.calculateEvictionRisk.mockResolvedValue(
        mockEvictionRisk,
      );
      mockContractHistoryService.getBiddingHistory.mockResolvedValue(
        mockBiddingHistory,
      );

      // Act
      const result = await service.processContract(mockContract, true);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.effectiveBid).toBe(mockEffectiveBid);
      expect(result.evictionRisk).toEqual(mockEvictionRisk);
      expect(result.biddingHistory).toEqual(mockBiddingHistory);

      // Verify method calls
      expect(mockContractHistoryService.getBiddingHistory).toHaveBeenCalledWith(
        mockContract.address,
      );
    });
  });
});
