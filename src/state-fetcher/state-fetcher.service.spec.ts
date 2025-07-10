import { Test, TestingModule } from '@nestjs/testing';
import { StateFetcherService } from './state-fetcher.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Blockchain } from '../blockchains/entities/blockchain.entity';
import { ContractInteractionService, StateStorageService } from './services';
import { StateFetcherConfig } from './state-fetcher.config';

describe('StateFetcherService', () => {
  let service: StateFetcherService;
  let mockBlockchainRepository: {
    find: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockContractInteractionService: {
    getContractState: jest.Mock;
  };
  let mockStateStorageService: {
    saveBlockchainState: jest.Mock;
  };

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'test-blockchain-id',
      name: 'Test Blockchain',
      chainId: 12345,
      rpcUrl: 'https://test-rpc.com',
      fastSyncRpcUrl: 'https://test-fast-rpc.com',
      rpcWssUrl: 'wss://test-ws.com',
      cacheManagerAddress: '0x1234567890123456789012345678901234567890',
      cacheManagerAutomationAddress:
        '0x0987654321098765432109876543210987654321',
      arbWasmCacheAddress: '0x1111111111111111111111111111111111111111',
      arbWasmAddress: '0x2222222222222222222222222222222222222222',
      originBlock: 0,
      lastSyncedBlock: 0,
      lastProcessedBlockNumber: 0,
      enabled: true,
    }) as Blockchain;

  const createMockConfig = (): StateFetcherConfig => ({
    pollingInterval: '*/5 * * * *',
    enableInitialPolling: true,
    enableMetrics: false,
    contractTimeout: 30000,
    maxRetryAttempts: 3,
    retryDelay: 1000,
  });

  beforeEach(async () => {
    mockBlockchainRepository = {
      find: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    mockContractInteractionService = {
      getContractState: jest.fn(),
    };

    mockStateStorageService = {
      saveBlockchainState: jest.fn(),
    };

    // Set up default config mock before creating the service
    mockConfigService.get.mockReturnValue(createMockConfig());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateFetcherService,
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ContractInteractionService,
          useValue: mockContractInteractionService,
        },
        {
          provide: StateStorageService,
          useValue: mockStateStorageService,
        },
      ],
    }).compile();

    service = module.get<StateFetcherService>(StateFetcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Service Setup', () => {
    it('should be defined', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(createMockConfig());

      expect(service).toBeDefined();
    });
  });

  describe('onModuleInit', () => {
    it('should perform initial polling when enabled', async () => {
      // Arrange
      const config = createMockConfig();
      const blockchain = createMockBlockchain();
      const mockStateData = {
        entries: [],
        decayRate: '100',
        cacheSize: '1000',
        queueSize: '500',
        isPaused: false,
        blockNumber: 12345,
        blockTimestamp: new Date(),
        totalContractsCached: 0,
      };

      mockConfigService.get.mockReturnValue(config);
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractInteractionService.getContractState.mockResolvedValue(
        mockStateData,
      );
      mockStateStorageService.saveBlockchainState.mockResolvedValue(undefined);

      // Mock the private methods
      const createProviderSpy = jest
        .spyOn(service as any, 'createProvider')
        .mockResolvedValue({} as any);

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
      expect(
        mockContractInteractionService.getContractState,
      ).toHaveBeenCalledWith(blockchain, expect.any(Object));
      expect(mockStateStorageService.saveBlockchainState).toHaveBeenCalledWith(
        blockchain,
        mockStateData,
      );

      createProviderSpy.mockRestore();
    });

    it('should handle empty blockchain list gracefully', async () => {
      // Arrange
      const config = createMockConfig();
      mockConfigService.get.mockReturnValue(config);
      mockBlockchainRepository.find.mockResolvedValue([]);

      // Act
      await service.onModuleInit();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalled();
      expect(
        mockContractInteractionService.getContractState,
      ).not.toHaveBeenCalled();
    });
  });

  describe('handleCron', () => {
    it('should poll all enabled blockchains', async () => {
      // Arrange
      const config = createMockConfig();
      const blockchain1 = { ...createMockBlockchain(), id: 'blockchain-1' };
      const blockchain2 = { ...createMockBlockchain(), id: 'blockchain-2' };
      const mockStateData = {
        entries: [],
        decayRate: '100',
        cacheSize: '1000',
        queueSize: '500',
        isPaused: false,
        blockNumber: 12345,
        blockTimestamp: new Date(),
        totalContractsCached: 0,
      };

      mockConfigService.get.mockReturnValue(config);
      mockBlockchainRepository.find.mockResolvedValue([
        blockchain1,
        blockchain2,
      ]);
      mockContractInteractionService.getContractState.mockResolvedValue(
        mockStateData,
      );
      mockStateStorageService.saveBlockchainState.mockResolvedValue(undefined);

      // Mock the private methods
      const createProviderSpy = jest
        .spyOn(service as any, 'createProvider')
        .mockResolvedValue({} as any);

      // Act
      await service.handleCron();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
      expect(
        mockContractInteractionService.getContractState,
      ).toHaveBeenCalledTimes(2);
      expect(mockStateStorageService.saveBlockchainState).toHaveBeenCalledTimes(
        2,
      );

      createProviderSpy.mockRestore();
    });

    it('should handle empty blockchain list gracefully', async () => {
      // Arrange
      const config = createMockConfig();
      mockConfigService.get.mockReturnValue(config);
      mockBlockchainRepository.find.mockResolvedValue([]);

      // Act
      await service.handleCron();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalled();
      expect(
        mockContractInteractionService.getContractState,
      ).not.toHaveBeenCalled();
    });

    it('should handle blockchain polling errors gracefully', async () => {
      // Arrange
      const config = createMockConfig();
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue(config);
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractInteractionService.getContractState.mockRejectedValue(
        new Error('Network error'),
      );

      // Mock the private methods
      const createProviderSpy = jest
        .spyOn(service as any, 'createProvider')
        .mockResolvedValue({} as any);

      // Act
      await service.handleCron();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalled();
      expect(
        mockContractInteractionService.getContractState,
      ).toHaveBeenCalled();
      expect(
        mockStateStorageService.saveBlockchainState,
      ).not.toHaveBeenCalled();

      createProviderSpy.mockRestore();
    });
  });

  describe('validateBlockchainConfig', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue(createMockConfig());
    });

    it('should pass validation for valid blockchain config', () => {
      // Arrange
      const blockchain = createMockBlockchain();

      // Act & Assert
      expect(() =>
        service['validateBlockchainConfig'](blockchain),
      ).not.toThrow();
    });

    it('should throw error for missing RPC URL', () => {
      // Arrange
      const blockchain = { ...createMockBlockchain(), rpcUrl: '' };

      // Act & Assert
      expect(() => service['validateBlockchainConfig'](blockchain)).toThrow();
    });

    it('should throw error for missing cache manager address', () => {
      // Arrange
      const blockchain = { ...createMockBlockchain(), cacheManagerAddress: '' };

      // Act & Assert
      expect(() => service['validateBlockchainConfig'](blockchain)).toThrow();
    });
  });
});
