import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContractSelectionService } from './contract-selection.service';
import { ProviderManager } from 'src/common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';

describe('ContractSelectionService', () => {
  let service: ContractSelectionService;
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockProviderManager: {
    getContract: jest.Mock;
    getProvider: jest.Mock;
  };

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      chainId: 421614,
      enabled: true,
    }) as Blockchain;

  const createMockContract = () => ({
    getContractsPaginated: jest.fn(),
    'getMinBid(address)': jest.fn(),
    cacheSize: jest.fn(),
    queueSize: jest.fn(),
    decay: jest.fn(),
    cacheThreshold: jest.fn(),
    horizonSeconds: jest.fn(),
    bidIncrement: jest.fn(),
  });

  const createMockProvider = () => ({
    getCode: jest.fn(),
  });

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockProviderManager = {
      getContract: jest.fn(),
      getProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractSelectionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ProviderManager,
          useValue: mockProviderManager,
        },
      ],
    }).compile();

    service = module.get<ContractSelectionService>(ContractSelectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('selectOptimalBids', () => {
    it('should return empty array when no contracts found', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ paginationLimit: 30 });

      const mockCmaContract = createMockContract();
      mockCmaContract.getContractsPaginated.mockResolvedValue({
        userData: [],
        hasMore: false,
      });
      // Mock the new getter methods
      mockCmaContract.cacheThreshold.mockResolvedValue(98);
      mockCmaContract.horizonSeconds.mockResolvedValue(2592000);
      mockCmaContract.bidIncrement.mockResolvedValue(1);

      mockProviderManager.getContract.mockReturnValue(mockCmaContract);

      // Act
      const result = await service.selectOptimalBids(blockchain);

      // Assert
      expect(result).toEqual([]);
      expect(mockCmaContract.getContractsPaginated).toHaveBeenCalled();
    });

    it('should handle errors and return empty array', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ paginationLimit: 30 });
      mockProviderManager.getContract.mockImplementation(() => {
        throw new Error('Provider error');
      });

      // Act
      const result = await service.selectOptimalBids(blockchain);

      // Assert
      expect(result).toEqual([]);
    });

    it('should select eligible contracts', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ paginationLimit: 30 });

      const mockCmaContract = createMockContract();
      const mockCmContract = createMockContract();
      const mockArbWasmCacheContract = {
        codehashIsCached: jest.fn(),
      };
      const mockProvider = createMockProvider();

      mockCmaContract.getContractsPaginated.mockResolvedValue({
        userData: [
          {
            user: '0x123',
            contracts: [
              {
                contractAddress: '0xABC',
                enabled: true,
                maxBid: 1000n,
              },
            ],
          },
        ],
        hasMore: false,
      });
      // Mock the new getter methods with realistic values
      mockCmaContract.cacheThreshold.mockResolvedValue(98);
      mockCmaContract.horizonSeconds.mockResolvedValue(2592000); // 30 days
      mockCmaContract.bidIncrement.mockResolvedValue(1);

      mockCmContract['getMinBid(address)'].mockResolvedValue(500n);
      mockCmContract.cacheSize.mockResolvedValue(100n);
      mockCmContract.queueSize.mockResolvedValue(98n);
      mockCmContract.decay.mockResolvedValue(1000n);
      mockProvider.getCode.mockResolvedValue(
        '0x608060405234801561001057600080fd5b50',
      );
      mockArbWasmCacheContract.codehashIsCached.mockResolvedValue(false);

      mockProviderManager.getContract
        .mockReturnValueOnce(mockCmaContract)
        .mockReturnValueOnce(mockCmContract)
        .mockReturnValueOnce(mockArbWasmCacheContract);
      mockProviderManager.getProvider.mockReturnValue(mockProvider);

      // Act
      const result = await service.selectOptimalBids(blockchain);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        user: '0x123',
        address: '0xABC',
      });
    });
  });
});
