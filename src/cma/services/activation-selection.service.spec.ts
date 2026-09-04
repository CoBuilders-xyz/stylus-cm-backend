import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AbiCoder, Interface } from 'ethers';
import { ActivationSelectionService } from './activation-selection.service';
import { ProviderManager } from 'src/common/utils/provider.util';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { Contract } from 'src/contracts/entities/contract.entity';
import { abi as cmaAbi } from 'src/common/abis/cacheManagerAutomation/CacheManagerAutomation.json';

const coder = AbiCoder.defaultAbiCoder();
const cmaIface = new Interface(cmaAbi);

// Solidity layout of ICacheManagerAutomation.ContractConfig (CMA v2.0).
const CONTRACT_CONFIG_V2 =
  'tuple(address contractAddress, bool biddingEnabled, bool autoActivate, uint256 maxBid, uint256 maxActivationCost)';
const USER_CONTRACTS_DATA_V2 = `tuple(address user, ${CONTRACT_CONFIG_V2}[] contracts)`;

const USER = '0x1111111111111111111111111111111111111111';
const ESCROW = '0x2222222222222222222222222222222222222222';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

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

describe('ActivationSelectionService', () => {
  let service: ActivationSelectionService;
  let mockConfigService: { get: jest.Mock };
  let mockProviderManager: { getContract: jest.Mock };
  let mockContractRepository: { find: jest.Mock };
  let escrowCall: jest.Mock;

  const blockchain = {
    id: 'blockchain-123',
    name: 'Test Blockchain',
    chainId: 421614,
    enabled: true,
  } as Blockchain;

  const createCmaMock = (escrowBalance: bigint) => {
    // Minimal ethers runner: the service builds a real ethers.Contract for the
    // escrow and calls depositsOf(user) through cmaContract.runner.call().
    escrowCall = jest
      .fn()
      .mockResolvedValue(coder.encode(['uint256'], [escrowBalance]));
    return {
      maxActivationsPerIteration: jest.fn().mockResolvedValue(5n),
      getContractsPaginated: jest.fn(),
      escrow: jest.fn().mockResolvedValue(ESCROW),
      runner: { call: escrowCall },
    };
  };

  const createArbWasmMock = (timeLeft: bigint) => ({
    programTimeLeft: jest.fn().mockResolvedValue(timeLeft),
  });

  const dbContract = (address: string, maxActivationCost: string) =>
    ({
      id: `db-${address}`,
      address,
      autoActivate: true,
      maxActivationCost,
      activationStatus: 'unknown',
      activationRetryCount: 0,
      lastActivationTimestamp: null,
    }) as unknown as Contract;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue({ paginationLimit: 30 }),
    };
    mockProviderManager = { getContract: jest.fn() };
    mockContractRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivationSelectionService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProviderManager, useValue: mockProviderManager },
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
      ],
    }).compile();

    service = module.get(ActivationSelectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('selects an expired autoActivate contract even when biddingEnabled is false', async () => {
    // CMA v2: biddingEnabled only gates bidding; activation depends on autoActivate.
    const cma = createCmaMock(1_000n);
    cma.getContractsPaginated.mockResolvedValue(
      decodePaginated([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_A,
              biddingEnabled: false,
              autoActivate: true,
              maxBid: 111n,
              maxActivationCost: 500n,
            },
          ],
        ],
      ]),
    );
    mockProviderManager.getContract
      .mockReturnValueOnce(cma)
      .mockReturnValueOnce(createArbWasmMock(0n));
    mockContractRepository.find.mockResolvedValue([
      dbContract(CONTRACT_A, '500'),
    ]);

    const result = await service.selectOptimalActivations(blockchain);

    expect(result.maxActivationsPerIteration).toBe(5);
    expect(result.selectedContracts).toHaveLength(1);
    expect(result.selectedContracts[0].user.toLowerCase()).toBe(USER);
    expect(result.selectedContracts[0].address.toLowerCase()).toBe(CONTRACT_A);
    expect(escrowCall).toHaveBeenCalledTimes(1);
  });

  it('skips contracts whose autoActivate flag is false', async () => {
    // Distinct values so a swapped bool slot (biddingEnabled vs autoActivate)
    // would flip the outcome.
    const cma = createCmaMock(1_000n);
    cma.getContractsPaginated.mockResolvedValue(
      decodePaginated([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_B,
              biddingEnabled: true,
              autoActivate: false,
              maxBid: 333n,
              maxActivationCost: 444n,
            },
          ],
        ],
      ]),
    );
    mockProviderManager.getContract
      .mockReturnValueOnce(cma)
      .mockReturnValueOnce(createArbWasmMock(0n));
    mockContractRepository.find.mockResolvedValue([
      dbContract(CONTRACT_B, '444'),
    ]);

    const result = await service.selectOptimalActivations(blockchain);

    expect(result.selectedContracts).toEqual([]);
    expect(mockContractRepository.find).not.toHaveBeenCalled();
  });

  it('skips a contract when the escrow balance is below maxActivationCost', async () => {
    const cma = createCmaMock(100n);
    cma.getContractsPaginated.mockResolvedValue(
      decodePaginated([
        [
          USER,
          [
            {
              contractAddress: CONTRACT_A,
              biddingEnabled: true,
              autoActivate: true,
              maxBid: 111n,
              maxActivationCost: 500n,
            },
          ],
        ],
      ]),
    );
    mockProviderManager.getContract
      .mockReturnValueOnce(cma)
      .mockReturnValueOnce(createArbWasmMock(0n));
    mockContractRepository.find.mockResolvedValue([
      dbContract(CONTRACT_A, '500'),
    ]);

    const result = await service.selectOptimalActivations(blockchain);

    expect(result.selectedContracts).toEqual([]);
  });

  it('returns an empty result when the CMA call fails', async () => {
    mockProviderManager.getContract.mockImplementation(() => {
      throw new Error('Provider error');
    });

    const result = await service.selectOptimalActivations(blockchain);

    expect(result).toEqual({
      selectedContracts: [],
      maxActivationsPerIteration: 5,
    });
  });
});
