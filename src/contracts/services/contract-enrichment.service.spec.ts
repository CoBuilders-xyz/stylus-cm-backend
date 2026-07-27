import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ContractEnrichmentService } from './contract-enrichment.service';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { ContractBidAssessmentService } from './contract-bid-assessment.service';
import { ContractHistoryService } from './contract-history.service';
import { ProviderManager } from '../../common/utils/provider.util';
import { Contract } from '../entities/contract.entity';

// Fake selectors matching the ABI error names — only used to exercise the
// selector-matching branch of decodeProgramTimeLeftRevert.
const SELECTORS = {
  ProgramNotActivated: '0xaaaaaaaa',
  ProgramExpired: '0xbbbbbbbb',
  ProgramNeedsUpgrade: '0xcccccccc',
} as const;

function makeMockArbWasm(programTimeLeftImpl: jest.Mock) {
  return {
    programTimeLeft: programTimeLeftImpl,
    interface: {
      getError: jest.fn((name: keyof typeof SELECTORS) => ({
        selector: SELECTORS[name],
      })),
    },
  };
}

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
    getActivationHistory: jest.Mock;
  };
  let mockProviderManager: {
    getContract: jest.Mock;
  };
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    mockContractBidCalculatorService = {
      calculateCurrentContractEffectiveBid: jest.fn(),
    };

    mockContractBidAssessmentService = {
      calculateEvictionRisk: jest.fn(),
      getSuggestedBids: jest.fn(),
    };

    mockContractHistoryService = {
      getBiddingHistory: jest.fn(),
      getActivationHistory: jest.fn(),
    };

    mockProviderManager = {
      getContract: jest.fn(),
    };

    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: ProviderManager,
          useValue: mockProviderManager,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
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
    it('should process cached contract with effective bid, eviction risk, and programTimeLeft', async () => {
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
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockResolvedValue(3600n)),
      );

      const result = await service.processContract(mockContract);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.address).toBe(mockContract.address);
      expect(result.effectiveBid).toBe(mockEffectiveBid);
      expect(result.evictionRisk).toEqual(mockEvictionRisk);
      expect(result.minBid).toBe(mockEvictionRisk.cacheStats.minBid);
      expect(result.programTimeLeft).toBe('3600');
      expect(result.programTimeLeftReason).toBeNull();

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
      expect(
        mockContractHistoryService.getActivationHistory,
      ).not.toHaveBeenCalled();
    });

    it('should process non-cached contract with suggested bids and programTimeLeft', async () => {
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
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockResolvedValue(7200n)),
      );

      const result = await service.processContract(mockContract);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.address).toBe(mockContract.address);
      expect(result.suggestedBids).toEqual({
        suggestedBids: mockSuggestedBidsResult.suggestedBids,
        cacheStats: mockSuggestedBidsResult.cacheStats,
      });
      expect(result.minBid).toBe(mockSuggestedBidsResult.cacheStats.minBid);
      expect(result.programTimeLeft).toBe('7200');
      expect(result.programTimeLeftReason).toBeNull();

      expect(result.effectiveBid).toBeUndefined();
      expect(result.evictionRisk).toBeUndefined();

      expect(
        mockContractBidAssessmentService.getSuggestedBids,
      ).toHaveBeenCalledWith(2048, 'test-blockchain-id');

      expect(
        mockContractBidCalculatorService.calculateCurrentContractEffectiveBid,
      ).not.toHaveBeenCalled();
      expect(
        mockContractBidAssessmentService.calculateEvictionRisk,
      ).not.toHaveBeenCalled();
    });

    it('should include bidding history and activation history when requested', async () => {
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
      ];

      const mockActivationHistory = [
        {
          contractAddress: mockContract.address,
          eventType: 'ActivationPerformed',
          timestamp: new Date('2023-01-02T00:00:00Z'),
          blockNumber: 100,
          transactionHash: '0x789',
          user: '0xuser',
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
      mockContractHistoryService.getActivationHistory.mockResolvedValue(
        mockActivationHistory,
      );
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockResolvedValue(86400n)),
      );

      const result = await service.processContract(mockContract, true);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockContract.id);
      expect(result.effectiveBid).toBe(mockEffectiveBid);
      expect(result.evictionRisk).toEqual(mockEvictionRisk);
      expect(result.biddingHistory).toEqual(mockBiddingHistory);
      expect(result.activationHistory).toEqual(mockActivationHistory);
      expect(result.programTimeLeft).toBe('86400');
      expect(result.programTimeLeftReason).toBeNull();

      expect(mockContractHistoryService.getBiddingHistory).toHaveBeenCalledWith(
        mockContract.address,
      );
      expect(
        mockContractHistoryService.getActivationHistory,
      ).toHaveBeenCalledWith(mockContract.address);
    });
  });

  describe('readProgramTimeLeft revert decoding', () => {
    const baseContract = {
      id: 'revert-test',
      address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      blockchain: { id: 'test-blockchain-id' },
      bytecode: {
        id: 'bytecode-revert',
        size: '1024',
        lastBid: '0',
        bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
        isCached: false,
      },
    } as unknown as Contract;

    beforeEach(() => {
      mockContractBidAssessmentService.getSuggestedBids.mockResolvedValue({
        suggestedBids: { highRisk: '0', midRisk: '0', lowRisk: '0' },
        cacheStats: {
          utilization: 0,
          evictionRate: 0,
          medianBidPerByte: '0',
          competitiveness: 0,
          cacheSizeBytes: '0',
          usedCacheSizeBytes: '0',
          minBid: '0',
        },
      });
    });

    it.each([
      ['ProgramNotActivated', 'never_activated', SELECTORS.ProgramNotActivated],
      ['ProgramExpired', 'expired', SELECTORS.ProgramExpired],
      ['ProgramNeedsUpgrade', 'needs_upgrade', SELECTORS.ProgramNeedsUpgrade],
    ])(
      'maps %s revert (via selector) to reason %s',
      async (errorName, expectedReason, selector) => {
        const revertError = Object.assign(
          new Error(`execution reverted: ${errorName}`),
          { data: `${selector}00000000` },
        );

        mockProviderManager.getContract.mockReturnValue(
          makeMockArbWasm(jest.fn().mockRejectedValue(revertError)),
        );

        const result = await service.processContract(baseContract);

        expect(result.programTimeLeft).toBeNull();
        expect(result.programTimeLeftReason).toBe(expectedReason);
      },
    );

    it('falls back to error message matching when error data is not present', async () => {
      const revertError = new Error(
        'execution reverted (unknown custom error, unable to decode) ProgramNeedsUpgrade',
      );

      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockRejectedValue(revertError)),
      );

      const result = await service.processContract(baseContract);

      expect(result.programTimeLeft).toBeNull();
      expect(result.programTimeLeftReason).toBe('needs_upgrade');
    });

    it('returns null reason and warns for unknown reverts', async () => {
      const revertError = Object.assign(new Error('unknown revert'), {
        data: '0xdeadbeef',
      });

      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockRejectedValue(revertError)),
      );

      const result = await service.processContract(baseContract);

      expect(result.programTimeLeft).toBeNull();
      expect(result.programTimeLeftReason).toBeNull();
    });

    it('matches revert data even when the hex body is uppercased', async () => {
      // Some RPC wrappers return the selector bytes as uppercase hex. Selector
      // matching normalizes case on both sides so the reason still resolves.
      const upperBody = SELECTORS.ProgramExpired.slice(2).toUpperCase();
      const revertError = Object.assign(new Error('execution reverted'), {
        data: `0x${upperBody}00000000`,
      });

      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(jest.fn().mockRejectedValue(revertError)),
      );

      const result = await service.processContract(baseContract);

      expect(result.programTimeLeftReason).toBe('expired');
    });
  });

  describe('readProgramTimeLeft caching', () => {
    const baseContract = {
      id: 'cache-test',
      address: '0xCCcCCCcCcCCcCCCCcCCCcccccccccCcCcCCCCCCC',
      blockchain: { id: 'chain-1' },
      bytecode: {
        id: 'bytecode-cache',
        size: '1024',
        lastBid: '0',
        bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
        isCached: false,
      },
    } as unknown as Contract;

    beforeEach(() => {
      mockContractBidAssessmentService.getSuggestedBids.mockResolvedValue({
        suggestedBids: { highRisk: '0', midRisk: '0', lowRisk: '0' },
        cacheStats: {
          utilization: 0,
          evictionRate: 0,
          medianBidPerByte: '0',
          competitiveness: 0,
          cacheSizeBytes: '0',
          usedCacheSizeBytes: '0',
          minBid: '0',
        },
      });
    });

    it('returns the cached result and does not call the contract on cache hit', async () => {
      mockCacheManager.get.mockResolvedValueOnce({
        seconds: '4242',
        reason: null,
      });
      const programTimeLeftFn = jest.fn();
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(programTimeLeftFn),
      );

      const result = await service.processContract(baseContract);

      expect(result.programTimeLeft).toBe('4242');
      expect(result.programTimeLeftReason).toBeNull();
      expect(programTimeLeftFn).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('writes the on-chain result to the cache on cache miss', async () => {
      const programTimeLeftFn = jest.fn().mockResolvedValue(1234n);
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(programTimeLeftFn),
      );

      await service.processContract(baseContract);

      expect(programTimeLeftFn).toHaveBeenCalledWith(baseContract.address);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `programTimeLeft:chain-1:${baseContract.address.toLowerCase()}`,
        { seconds: '1234', reason: null },
        expect.any(Number),
      );
    });

    it('deduplicates concurrent reads for the same contract (single-flight)', async () => {
      let resolveRpc: (value: bigint) => void = () => {};
      const programTimeLeftFn = jest.fn().mockImplementation(
        () =>
          new Promise<bigint>((resolve) => {
            resolveRpc = resolve;
          }),
      );
      mockProviderManager.getContract.mockReturnValue(
        makeMockArbWasm(programTimeLeftFn),
      );

      const p1 = service.processContract(baseContract);
      const p2 = service.processContract(baseContract);

      // Let both callers advance through cache.get() and hit the in-flight map.
      await Promise.resolve();
      await Promise.resolve();

      resolveRpc(9999n);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(programTimeLeftFn).toHaveBeenCalledTimes(1);
      expect(r1.programTimeLeft).toBe('9999');
      expect(r2.programTimeLeft).toBe('9999');
    });

    it('resolves with null fields and warns when the RPC exceeds the timeout budget', async () => {
      jest.useFakeTimers();
      try {
        // Suppress the warn spam from bubbling to the jest output.
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

        // RPC that never resolves — forces the race to hit the timeout branch.
        const programTimeLeftFn = jest
          .fn()
          .mockImplementation(() => new Promise<bigint>(() => {}));
        mockProviderManager.getContract.mockReturnValue(
          makeMockArbWasm(programTimeLeftFn),
        );

        const resultPromise = service.processContract(baseContract);
        await jest.advanceTimersByTimeAsync(2_000);
        const result = await resultPromise;

        expect(result.programTimeLeft).toBeNull();
        expect(result.programTimeLeftReason).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not surface unhandled rejections when the reader throws unexpectedly', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      mockCacheManager.get.mockRejectedValueOnce(new Error('cache down'));

      const result = await service.processContract(baseContract);

      expect(result.programTimeLeft).toBeNull();
      expect(result.programTimeLeftReason).toBeNull();
    });
  });
});
