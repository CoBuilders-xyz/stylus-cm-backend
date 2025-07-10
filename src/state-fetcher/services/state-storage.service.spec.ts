import { Test, TestingModule } from '@nestjs/testing';
import { StateStorageService } from './state-storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainStateData } from '../interfaces';

describe('StateStorageService', () => {
  let service: StateStorageService;
  let mockBlockchainStateRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
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

  const createMockStateData = (): BlockchainStateData => ({
    entries: [],
    decayRate: '100',
    cacheSize: '1000',
    queueSize: '500',
    isPaused: false,
    blockNumber: 12345,
    blockTimestamp: new Date('2023-01-01T00:00:00Z'),
    totalContractsCached: 0,
  });

  beforeEach(async () => {
    mockBlockchainStateRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateStorageService,
        {
          provide: getRepositoryToken(BlockchainState),
          useValue: mockBlockchainStateRepository,
        },
      ],
    }).compile();

    service = module.get<StateStorageService>(StateStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Service Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('saveBlockchainState', () => {
    it('should save blockchain state successfully', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const stateData = createMockStateData();
      const mockCreatedState = { id: 1, ...stateData };

      mockBlockchainStateRepository.create.mockReturnValue(mockCreatedState);
      mockBlockchainStateRepository.save.mockResolvedValue(mockCreatedState);

      // Act
      await service.saveBlockchainState(blockchain, stateData);

      // Assert
      expect(mockBlockchainStateRepository.create).toHaveBeenCalledWith({
        blockchain,
        minBid: '0',
        decayRate: '100',
        cacheSize: '1000',
        queueSize: '500',
        isPaused: false,
        blockNumber: 12345,
        blockTimestamp: stateData.blockTimestamp,
        totalContractsCached: '0',
      });
      expect(mockBlockchainStateRepository.save).toHaveBeenCalledWith(
        mockCreatedState,
      );
    });

    it('should handle save errors', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const stateData = createMockStateData();
      const mockCreatedState = { id: 1, ...stateData };

      mockBlockchainStateRepository.create.mockReturnValue(mockCreatedState);
      mockBlockchainStateRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        service.saveBlockchainState(blockchain, stateData),
      ).rejects.toThrow();
    });
  });

  describe('getLatestState', () => {
    it('should return latest state when found', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const mockState = {
        id: 1,
        blockNumber: 12345,
        blockTimestamp: new Date('2023-01-01T00:00:00Z'),
        decayRate: '100',
        cacheSize: '1000',
        queueSize: '500',
        isPaused: false,
      } as BlockchainState;

      mockBlockchainStateRepository.findOne.mockResolvedValue(mockState);

      // Act
      const result = await service.getLatestState(blockchainId);

      // Assert
      expect(result).toEqual(mockState);
      expect(mockBlockchainStateRepository.findOne).toHaveBeenCalledWith({
        where: { blockchain: { id: blockchainId } },
        order: { timestamp: 'DESC' },
      });
    });

    it('should return null when no state found', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      mockBlockchainStateRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getLatestState(blockchainId);

      // Assert
      expect(result).toBeNull();
      expect(mockBlockchainStateRepository.findOne).toHaveBeenCalledWith({
        where: { blockchain: { id: blockchainId } },
        order: { timestamp: 'DESC' },
      });
    });

    it('should handle query errors gracefully', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      mockBlockchainStateRepository.findOne.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      const result = await service.getLatestState(blockchainId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
