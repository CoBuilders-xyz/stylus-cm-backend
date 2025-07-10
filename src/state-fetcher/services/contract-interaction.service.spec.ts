import { Test, TestingModule } from '@nestjs/testing';
import { ContractInteractionService } from './contract-interaction.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ethers } from 'ethers';

// Mock the ethers module
jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn(),
    parseEther: jest.fn().mockReturnValue('100'),
  },
}));

describe('ContractInteractionService', () => {
  let service: ContractInteractionService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContractInteractionService],
    }).compile();

    service = module.get<ContractInteractionService>(
      ContractInteractionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Service Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getContractState', () => {
    it('should fetch contract state successfully', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const mockEntries = [
        { contractAddress: '0x123', size: 1000 },
        { contractAddress: '0x456', size: 2000 },
      ];
      const mockBlock = {
        number: 12345,
        timestamp: 1234567890,
      };

      const mockContract = {
        getEntries: jest.fn().mockResolvedValue(mockEntries),
        decay: jest.fn().mockResolvedValue('100'),
        cacheSize: jest.fn().mockResolvedValue('1000'),
        queueSize: jest.fn().mockResolvedValue('500'),
        isPaused: jest.fn().mockResolvedValue(false),
      };

      const mockProvider = {
        getBlock: jest.fn().mockResolvedValue(mockBlock),
      } as unknown as ethers.JsonRpcProvider;

      // Mock ethers.Contract
      const mockEthers = ethers as jest.Mocked<typeof ethers>;
      mockEthers.Contract = jest.fn().mockImplementation(() => mockContract);

      // Act
      const result = await service.getContractState(blockchain, mockProvider);

      // Assert
      expect(result).toEqual({
        entries: mockEntries,
        decayRate: '100',
        cacheSize: '1000',
        queueSize: '500',
        isPaused: false,
        blockNumber: 12345,
        blockTimestamp: new Date(1234567890 * 1000),
        totalContractsCached: 2,
      });

      expect(mockContract.getEntries).toHaveBeenCalled();
      expect(mockContract.decay).toHaveBeenCalled();
      expect(mockContract.cacheSize).toHaveBeenCalled();
      expect(mockContract.queueSize).toHaveBeenCalled();
      expect(mockContract.isPaused).toHaveBeenCalled();
      expect(mockProvider.getBlock).toHaveBeenCalledWith('latest');
    });

    it('should handle missing block data', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const mockContract = {
        getEntries: jest.fn().mockResolvedValue([]),
        decay: jest.fn().mockResolvedValue('100'),
        cacheSize: jest.fn().mockResolvedValue('1000'),
        queueSize: jest.fn().mockResolvedValue('500'),
        isPaused: jest.fn().mockResolvedValue(false),
      };

      const mockProvider = {
        getBlock: jest.fn().mockResolvedValue(null),
      } as unknown as ethers.JsonRpcProvider;

      // Mock ethers.Contract
      const mockEthers = ethers as jest.Mocked<typeof ethers>;
      mockEthers.Contract = jest.fn().mockImplementation(() => mockContract);

      // Act & Assert
      await expect(
        service.getContractState(blockchain, mockProvider),
      ).rejects.toThrow();
    });

    it('should handle contract call failures', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const mockProvider = {} as ethers.JsonRpcProvider;

      // Mock ethers.Contract to throw error
      const mockEthers = ethers as jest.Mocked<typeof ethers>;
      mockEthers.Contract = jest.fn().mockImplementation(() => {
        throw new Error('Contract call failed');
      });

      // Act & Assert
      await expect(
        service.getContractState(blockchain, mockProvider),
      ).rejects.toThrow();
    });
  });
});
