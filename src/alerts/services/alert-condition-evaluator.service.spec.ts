import { Test, TestingModule } from '@nestjs/testing';
import { AlertConditionEvaluatorService } from './alert-condition-evaluator.service';
import { ContractBidCalculatorService } from 'src/contracts/services/contract-bid-calculator.service';
import { ProviderManager } from 'src/common/utils/provider.util';
import { Alert } from '../entities/alert.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { AlertType } from '../constants';

describe('AlertConditionEvaluatorService', () => {
  let service: AlertConditionEvaluatorService;
  let mockProviderManager: {
    getContract: jest.Mock;
  };
  let mockContractBidCalculatorService: {
    calculateCurrentContractEffectiveBid: jest.Mock;
  };

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.BID_SAFETY,
      value: '5', // 5% threshold
      userContract: {
        address: '0x1234567890123456789012345678901234567890',
        contract: {
          id: 'contract-123',
        },
      },
    }) as unknown as Alert;

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      chainId: 12345,
    }) as unknown as Blockchain;

  beforeEach(async () => {
    mockProviderManager = {
      getContract: jest.fn(),
    };

    mockContractBidCalculatorService = {
      calculateCurrentContractEffectiveBid: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertConditionEvaluatorService,
        {
          provide: ProviderManager,
          useValue: mockProviderManager,
        },
        {
          provide: ContractBidCalculatorService,
          useValue: mockContractBidCalculatorService,
        },
      ],
    }).compile();

    service = module.get<AlertConditionEvaluatorService>(
      AlertConditionEvaluatorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateBidSafetyCondition', () => {
    it('should return true when effective bid is below threshold (alert should trigger)', async () => {
      // Arrange
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const minBid = BigInt(1000);
      const effectiveBid = BigInt(800); // Below threshold
      const mockContract = {
        'getMinBid(address program)': jest.fn().mockResolvedValue(minBid),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        effectiveBid.toString(),
      );

      // Act
      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      // Assert
      expect(result).toBe(true);
      expect(mockProviderManager.getContract).toHaveBeenCalled();
      expect(mockContract['getMinBid(address program)']).toHaveBeenCalledWith(
        alert.userContract.address,
      );
      expect(
        mockContractBidCalculatorService.calculateCurrentContractEffectiveBid,
      ).toHaveBeenCalledWith(alert.userContract.contract);
    });

    it('should return false when effective bid is above threshold (alert should not trigger)', async () => {
      // Arrange
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const minBid = BigInt(1000);
      const effectiveBid = BigInt(1200); // Above threshold
      const mockContract = {
        'getMinBid(address program)': jest.fn().mockResolvedValue(minBid),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        effectiveBid.toString(),
      );

      // Act
      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should handle edge case where effective bid equals threshold', async () => {
      // Arrange
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const minBid = BigInt(1000);
      // With 5% alert value: threshold = (1000 * 105) / 100 = 1050
      const effectiveBid = BigInt(1050); // Exactly at threshold
      const mockContract = {
        'getMinBid(address program)': jest.fn().mockResolvedValue(minBid),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        effectiveBid.toString(),
      );

      // Act
      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      // Assert
      expect(result).toBe(false); // Not below threshold, so should not trigger
    });

    it('should handle contract call errors', async () => {
      // Arrange
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const mockContract = {
        'getMinBid(address program)': jest
          .fn()
          .mockRejectedValue(new Error('Contract call failed')),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);

      // Act & Assert
      await expect(
        service.evaluateBidSafetyCondition(alert, blockchain),
      ).rejects.toThrow('Contract call failed');
    });
  });
});
