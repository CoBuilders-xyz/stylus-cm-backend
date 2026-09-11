import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AbiCoder, Interface } from 'ethers';
import { ContractSelectionService } from './contract-selection.service';
import { ProviderManager } from 'src/common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { abi as cmaAbi } from 'src/common/abis/cacheManagerAutomation/CacheManagerAutomation.json';

const coder = AbiCoder.defaultAbiCoder();
const cmaIface = new Interface(cmaAbi);

// Solidity layout of ICacheManagerAutomation.ContractConfig (CMA v2.0).
const CONTRACT_CONFIG_V2 =
  'tuple(address contractAddress, bool biddingEnabled, bool autoActivate, uint256 maxBid, uint256 maxActivationCost)';
const USER_CONTRACTS_DATA_V2 = `tuple(address user, ${CONTRACT_CONFIG_V2}[] contracts)`;

type ConfigInput = {
  contractAddress: string;
  biddingEnabled: boolean;
  autoActivate: boolean;
  maxBid: bigint;
  maxActivationCost: bigint;
};

/**
 * Builds the exact object ethers returns for getContractsPaginated by
 * ABI-encoding the v2 tuple layout and decoding it with the real CMA ABI.
 */
const decodePaginated = (
  users: Array<[string, ConfigInput[]]>,
  hasMore = false,
) => {
  const data = coder.encode(
    [`${USER_CONTRACTS_DATA_V2}[]`, 'bool'],
    [
      users.map(([user, contracts]) => [
        user,
        contracts.map((c) => [
          c.contractAddress,
          c.biddingEnabled,
          c.autoActivate,
          c.maxBid,
          c.maxActivationCost,
        ]),
      ]),
      hasMore,
    ],
  );
  return cmaIface.decodeFunctionResult('getContractsPaginated', data);
};

const USER = '0x1111111111111111111111111111111111111111';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

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
                biddingEnabled: true,
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

  describe('selectOptimalBids with ABI-decoded ContractConfig (CMA v2.0)', () => {
    // Shared "cache is full, bid is affordable" chain state.
    const setupChain = (userConfigs: Array<[string, ConfigInput[]]>) => {
      const mockCmaContract = createMockContract();
      const mockCmContract = createMockContract();
      const mockArbWasmCacheContract = { codehashIsCached: jest.fn() };
      const mockProvider = createMockProvider();

      mockCmaContract.getContractsPaginated.mockResolvedValue(
        decodePaginated(userConfigs),
      );
      mockCmaContract.cacheThreshold.mockResolvedValue(98);
      mockCmaContract.horizonSeconds.mockResolvedValue(2592000);
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
    };

    beforeEach(() => {
      mockConfigService.get.mockReturnValue({ paginationLimit: 30 });
    });

    it('selects a contract with biddingEnabled=true (autoActivate=false, distinct amounts)', async () => {
      setupChain([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_A,
              biddingEnabled: true,
              autoActivate: false,
              maxBid: 1000n,
              maxActivationCost: 7n,
            },
          ],
        ],
      ]);

      const result = await service.selectOptimalBids(createMockBlockchain());

      expect(result).toHaveLength(1);
      expect(result[0].user.toLowerCase()).toBe(USER);
      expect(result[0].address.toLowerCase()).toBe(CONTRACT_A);
    });

    it('skips a contract with biddingEnabled=false even when autoActivate=true', async () => {
      // If the service read the wrong bool slot (autoActivate), this would be selected.
      setupChain([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_B,
              biddingEnabled: false,
              autoActivate: true,
              maxBid: 1000n,
              maxActivationCost: 7n,
            },
          ],
        ],
      ]);

      const result = await service.selectOptimalBids(createMockBlockchain());

      expect(result).toEqual([]);
    });

    it('skips a contract whose maxBid slot is too low even though maxActivationCost is high', async () => {
      // maxBid (7) < minBid (500) -> no bid. If the service read the
      // maxActivationCost slot as maxBid (v1 order), it would bid.
      setupChain([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_A,
              biddingEnabled: true,
              autoActivate: false,
              maxBid: 7n,
              maxActivationCost: 1000n,
            },
          ],
        ],
      ]);

      const result = await service.selectOptimalBids(createMockBlockchain());

      expect(result).toEqual([]);
    });

    it('does not select a legacy v1-shaped config that only has "enabled"', async () => {
      const mockCmaContract = createMockContract();
      mockCmaContract.getContractsPaginated.mockResolvedValue({
        userData: [
          {
            user: USER,
            contracts: [
              { contractAddress: CONTRACT_A, enabled: true, maxBid: 1000n },
            ],
          },
        ],
        hasMore: false,
      });
      mockCmaContract.cacheThreshold.mockResolvedValue(98);
      mockCmaContract.horizonSeconds.mockResolvedValue(2592000);
      mockCmaContract.bidIncrement.mockResolvedValue(1);
      const mockCmContract = createMockContract();
      mockCmContract.cacheSize.mockResolvedValue(100n);
      mockCmContract.queueSize.mockResolvedValue(98n);
      mockCmContract.decay.mockResolvedValue(1000n);
      const mockArbWasmCacheContract = {
        codehashIsCached: jest.fn().mockResolvedValue(false),
      };
      const mockProvider = createMockProvider();
      mockProvider.getCode.mockResolvedValue('0x6080');
      mockProviderManager.getContract
        .mockReturnValueOnce(mockCmaContract)
        .mockReturnValueOnce(mockCmContract)
        .mockReturnValueOnce(mockArbWasmCacheContract);
      mockProviderManager.getProvider.mockReturnValue(mockProvider);

      const result = await service.selectOptimalBids(createMockBlockchain());

      expect(result).toEqual([]);
    });
  });
});
