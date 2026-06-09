import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
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
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const mockContract = {
        getSmallestEntries: jest
          .fn()
          .mockResolvedValue([{ code: '0x00', size: 100n, bid: 1000n }]),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        '800',
      );

      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      expect(result).toBe(true);
      expect(mockProviderManager.getContract).toHaveBeenCalled();
      expect(mockContract.getSmallestEntries).toHaveBeenCalledWith(1);
      expect(
        mockContractBidCalculatorService.calculateCurrentContractEffectiveBid,
      ).toHaveBeenCalledWith(alert.userContract.contract);
    });

    it('should return false when effective bid is above threshold (alert should not trigger)', async () => {
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const mockContract = {
        getSmallestEntries: jest
          .fn()
          .mockResolvedValue([{ code: '0x00', size: 100n, bid: 1000n }]),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        '1200',
      );

      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      expect(result).toBe(false);
    });

    it('should handle edge case where effective bid equals threshold', async () => {
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      // With 5% alert value: threshold = (1000 * 10500) / 10000 = 1050
      const mockContract = {
        getSmallestEntries: jest
          .fn()
          .mockResolvedValue([{ code: '0x00', size: 100n, bid: 1000n }]),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        '1050',
      );

      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      expect(result).toBe(false);
    });

    it('should return false when cache is empty (no entries)', async () => {
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const mockContract = {
        getSmallestEntries: jest.fn().mockResolvedValue([]),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);
      mockContractBidCalculatorService.calculateCurrentContractEffectiveBid.mockResolvedValue(
        '100',
      );

      const result = await service.evaluateBidSafetyCondition(
        alert,
        blockchain,
      );

      // minBid=0, threshold=0, effectiveBid=100 > 0 → false
      expect(result).toBe(false);
    });

    it('should handle contract call errors', async () => {
      const alert = createMockAlert();
      const blockchain = createMockBlockchain();
      const mockContract = {
        getSmallestEntries: jest
          .fn()
          .mockRejectedValue(new Error('Contract call failed')),
      };

      mockProviderManager.getContract.mockReturnValue(mockContract);

      await expect(
        service.evaluateBidSafetyCondition(alert, blockchain),
      ).rejects.toThrow('Contract call failed');
    });
  });

  describe('evaluateGasCondition', () => {
    const mockEscrowAddress = '0xEscrow0000000000000000000000000000000000';

    const createGasAlert = (
      type: AlertType.NO_GAS | AlertType.LOW_GAS,
      value?: string,
    ): Alert =>
      ({
        id: 'gas-alert-1',
        type,
        value,
        user: { address: '0xUserAddress000000000000000000000000000000' },
        userContract: { address: '0xContract00000000000000000000000000000000' },
      }) as unknown as Alert;

    const createMockCmaAndEscrow = (balance: bigint) => {
      const mockDepositsOf = jest.fn().mockResolvedValue(balance.toString());
      const mockCmaContract = {
        escrow: jest.fn().mockResolvedValue(mockEscrowAddress),
        runner: {},
      };

      // Mock ethers.Contract constructor for escrow
      const originalContract = ethers.Contract;
      jest
        .spyOn(ethers, 'Contract' as any)
        .mockImplementation((address: string, abi: any, runner: any) => {
          if (address === mockEscrowAddress) {
            return { depositsOf: mockDepositsOf } as any;
          }
          return new originalContract(address, abi, runner);
        });

      return { mockCmaContract, mockDepositsOf };
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should trigger noGas when balance is zero', async () => {
      const alert = createGasAlert(AlertType.NO_GAS);
      const blockchain = createMockBlockchain();
      const { mockCmaContract } = createMockCmaAndEscrow(0n);

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      const result = await service.evaluateGasCondition(alert, blockchain);
      expect(result).toBe(true);
    });

    it('should not trigger noGas when balance is positive', async () => {
      const alert = createGasAlert(AlertType.NO_GAS);
      const blockchain = createMockBlockchain();
      const { mockCmaContract } = createMockCmaAndEscrow(
        ethers.parseEther('0.01'),
      );

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      const result = await service.evaluateGasCondition(alert, blockchain);
      expect(result).toBe(false);
    });

    it('should trigger lowGas when balance is below threshold', async () => {
      const alert = createGasAlert(AlertType.LOW_GAS, '1'); // 1 ETH threshold
      const blockchain = createMockBlockchain();
      const { mockCmaContract } = createMockCmaAndEscrow(
        ethers.parseEther('0.5'),
      );

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      const result = await service.evaluateGasCondition(alert, blockchain);
      expect(result).toBe(true);
    });

    it('should not trigger lowGas when balance meets threshold', async () => {
      const alert = createGasAlert(AlertType.LOW_GAS, '1'); // 1 ETH threshold
      const blockchain = createMockBlockchain();
      const { mockCmaContract } = createMockCmaAndEscrow(
        ethers.parseEther('2'),
      );

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      const result = await service.evaluateGasCondition(alert, blockchain);
      expect(result).toBe(false);
    });

    it('should handle escrow read errors', async () => {
      const alert = createGasAlert(AlertType.NO_GAS);
      const blockchain = createMockBlockchain();
      const mockCmaContract = {
        escrow: jest.fn().mockRejectedValue(new Error('RPC error')),
        runner: {},
      };

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      await expect(
        service.evaluateGasCondition(alert, blockchain),
      ).rejects.toThrow('RPC error');
    });
  });
});
