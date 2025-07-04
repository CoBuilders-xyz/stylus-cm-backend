import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BatchProcessorService } from './batch-processor.service';
import { EngineUtil } from '../utils/engine.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { SelectedContract } from '../interfaces';

describe('BatchProcessorService', () => {
  let service: BatchProcessorService;
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockEngineUtil: {
    writeContract: jest.Mock;
  };

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      chainId: 421614,
      cacheManagerAutomationAddress: '0x456',
      enabled: true,
    }) as Blockchain;

  const createMockContracts = (): SelectedContract[] => [
    { user: '0x123', address: '0xABC' },
    { user: '0x456', address: '0xDEF' },
  ];

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockEngineUtil = {
      writeContract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EngineUtil,
          useValue: mockEngineUtil,
        },
      ],
    }).compile();

    service = module.get<BatchProcessorService>(BatchProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processContractBatches', () => {
    it('should return empty result when no contracts provided', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const contracts: SelectedContract[] = [];
      mockConfigService.get.mockReturnValue({ batchSize: 50 });

      // Act
      const result = await service.processContractBatches(
        blockchain,
        contracts,
      );

      // Assert
      expect(result.totalBatches).toBe(0);
      expect(result.totalContracts).toBe(0);
      expect(result.processedContracts).toBe(0);
    });

    it('should process contracts successfully', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const contracts = createMockContracts();
      mockConfigService.get.mockReturnValue({ batchSize: 50 });
      mockEngineUtil.writeContract.mockResolvedValue({ queueId: 'queue-123' });

      // Act
      const result = await service.processContractBatches(
        blockchain,
        contracts,
      );

      // Assert
      expect(result.totalBatches).toBe(1);
      expect(result.totalContracts).toBe(2);
      expect(result.processedContracts).toBe(2);
      expect(result.successfulBatches).toBe(1);
      expect(result.failedBatches).toBe(0);
      expect(mockEngineUtil.writeContract).toHaveBeenCalledWith(
        blockchain.chainId,
        blockchain.cacheManagerAutomationAddress,
        expect.objectContaining({
          functionName: 'function placeBids((address,address)[])',
          args: [expect.any(Array)],
        }),
      );
    });

    it('should handle batch processing errors', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const contracts = createMockContracts();
      mockConfigService.get.mockReturnValue({ batchSize: 50 });
      mockEngineUtil.writeContract.mockRejectedValue(new Error('Engine error'));

      // Act
      const result = await service.processContractBatches(
        blockchain,
        contracts,
      );

      // Assert
      expect(result.totalBatches).toBe(1);
      expect(result.totalContracts).toBe(2);
      expect(result.processedContracts).toBe(0);
      expect(result.successfulBatches).toBe(0);
      expect(result.failedBatches).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should split large contract lists into multiple batches', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const contracts = Array.from({ length: 120 }, (_, i) => ({
        user: `0x${i}`,
        address: `0x${i}ABC`,
      }));
      mockConfigService.get.mockReturnValue({ batchSize: 50 });
      mockEngineUtil.writeContract.mockResolvedValue({ queueId: 'queue-123' });

      // Act
      const result = await service.processContractBatches(
        blockchain,
        contracts,
      );

      // Assert
      expect(result.totalBatches).toBe(3); // 120 contracts / 50 batch size = 3 batches
      expect(result.totalContracts).toBe(120);
      expect(mockEngineUtil.writeContract).toHaveBeenCalledTimes(3);
    });
  });
});
