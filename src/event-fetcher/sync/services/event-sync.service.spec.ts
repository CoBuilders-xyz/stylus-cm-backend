import { Test, TestingModule } from '@nestjs/testing';
import { EventSyncService } from './event-sync.service';
import {
  ProviderManager,
  ContractType,
} from '../../../common/utils/provider.util';
import { EventStorageService } from '../../shared/services/event-storage.service';
import { EventConfigService } from '../../shared/services/event-config.service';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { ethers } from 'ethers';
import * as contractCallUtil from '../../utils/contract-call.util';
import {
  BlockchainEventData,
  EventProcessResult,
} from '../../shared/interfaces/event.interface';

describe('EventSyncService', () => {
  let service: EventSyncService;
  let mockEventStorageService: {
    getLastSyncedBlock: jest.Mock;
    updateLastSyncedBlock: jest.Mock;
    prepareEvents: jest.Mock;
    storeEvents: jest.Mock;
  };
  let mockEventConfigService: {
    getRetries: jest.Mock;
    getRetryDelay: jest.Mock;
  };
  let mockProviderManager: {
    getFastSyncProvider: jest.Mock;
    getContractWithFastSyncProvider: jest.Mock;
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

  beforeEach(async () => {
    // Create mocks for all dependencies
    mockEventStorageService = {
      getLastSyncedBlock: jest.fn(),
      updateLastSyncedBlock: jest.fn(),
      prepareEvents: jest.fn(),
      storeEvents: jest.fn(),
    };

    mockEventConfigService = {
      getRetries: jest.fn(),
      getRetryDelay: jest.fn(),
    };

    mockProviderManager = {
      getFastSyncProvider: jest.fn(),
      getContractWithFastSyncProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSyncService,
        { provide: EventStorageService, useValue: mockEventStorageService },
        { provide: EventConfigService, useValue: mockEventConfigService },
        { provide: ProviderManager, useValue: mockProviderManager },
      ],
    }).compile();

    service = module.get<EventSyncService>(EventSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncBlockchainEvents', () => {
    it('should fetch, prepare, and store events and update last synced block (happy path)', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const provider = {} as ethers.JsonRpcProvider;
      const eventTypes = ['InsertBid', 'DeleteBid'];
      const lastSyncedBlock = 100;
      const latestBlock = 105;
      const now = new Date();
      const mockEvents: BlockchainEventData[] = [
        {
          blockchain,
          contractName: 'CacheManager',
          contractAddress: blockchain.cacheManagerAddress,
          eventName: 'InsertBid',
          blockTimestamp: now,
          blockNumber: 101,
          transactionHash: '0xabc',
          logIndex: 0,
          isRealTime: false,
          eventData: {},
        },
        {
          blockchain,
          contractName: 'CacheManager',
          contractAddress: blockchain.cacheManagerAddress,
          eventName: 'DeleteBid',
          blockTimestamp: now,
          blockNumber: 102,
          transactionHash: '0xdef',
          logIndex: 1,
          isRealTime: false,
          eventData: {},
        },
      ];
      const preparedEvents = mockEvents;
      const cacheManagerContract = {
        address: '0xabc',
      } as unknown as ethers.Contract;
      const cacheManagerAutomationContract = {
        address: '0xdef',
      } as unknown as ethers.Contract;

      mockEventStorageService.getLastSyncedBlock.mockResolvedValue(
        lastSyncedBlock,
      );
      mockEventConfigService.getRetries.mockReturnValue(2);
      mockEventConfigService.getRetryDelay.mockReturnValue(100);
      mockProviderManager.getContractWithFastSyncProvider.mockImplementation(
        (blockchainArg: Blockchain, contractType: ContractType) => {
          if (contractType === ContractType.CACHE_MANAGER)
            return cacheManagerContract;
          if (contractType === ContractType.CACHE_MANAGER_AUTOMATION)
            return cacheManagerAutomationContract;
          throw new Error('Unknown contract type');
        },
      );

      jest
        .spyOn(contractCallUtil, 'safeContractCall')
        .mockResolvedValue(latestBlock);

      // Patch fetchEvents to return mock events
      service['fetchEvents'] = jest
        .fn()
        .mockResolvedValueOnce(mockEvents)
        .mockResolvedValueOnce(mockEvents);
      mockEventStorageService.prepareEvents.mockResolvedValue(preparedEvents);
      mockEventStorageService.storeEvents.mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        totalEvents: 2,
      } as EventProcessResult);
      mockEventStorageService.updateLastSyncedBlock.mockResolvedValue(
        undefined,
      );

      // Act
      await service.syncBlockchainEvents(blockchain, provider, eventTypes);

      // Assert
      expect(mockEventStorageService.getLastSyncedBlock).toHaveBeenCalledWith(
        blockchain,
      );
      expect(service['fetchEvents'] as jest.Mock).toHaveBeenCalledTimes(2);
      expect(mockEventStorageService.prepareEvents).toHaveBeenCalledWith(
        blockchain,
        [...mockEvents, ...mockEvents],
        provider,
      );
      expect(mockEventStorageService.storeEvents).toHaveBeenCalledWith(
        preparedEvents,
      );
      expect(
        mockEventStorageService.updateLastSyncedBlock,
      ).toHaveBeenCalledWith(blockchain, latestBlock);
    });
  });

  describe('fetchEvents', () => {
    it('should fetch events for multiple event types and aggregate results', async () => {
      // Arrange
      const contract = {
        filters: {
          InsertBid: jest.fn().mockReturnValue({}),
          DeleteBid: jest.fn().mockReturnValue({}),
        },
      } as unknown as ethers.Contract;
      const eventTypes = ['InsertBid', 'DeleteBid'];
      const fromBlock = 100;
      const toBlock = 105;

      const mockInsertBidEvents = [
        { eventName: 'InsertBid', blockNumber: 101, logIndex: 0 },
        { eventName: 'InsertBid', blockNumber: 102, logIndex: 1 },
      ];
      const mockDeleteBidEvents = [
        { eventName: 'DeleteBid', blockNumber: 103, logIndex: 0 },
      ];

      // Mock safeContractCall to return different events for each event type
      jest
        .spyOn(contractCallUtil, 'safeContractCall')
        .mockResolvedValueOnce(mockInsertBidEvents) // First call for InsertBid
        .mockResolvedValueOnce(mockDeleteBidEvents); // Second call for DeleteBid

      mockEventConfigService.getRetries.mockReturnValue(3);
      mockEventConfigService.getRetryDelay.mockReturnValue(100);

      // Act
      const result = await service['fetchEvents'](
        contract,
        eventTypes,
        fromBlock,
        toBlock,
      );

      // Assert
      expect(contract.filters.InsertBid).toHaveBeenCalled();
      expect(contract.filters.DeleteBid).toHaveBeenCalled();
      expect(contractCallUtil.safeContractCall).toHaveBeenCalledTimes(2);
      expect(contractCallUtil.safeContractCall).toHaveBeenCalledWith(
        contract,
        'queryFilter',
        [{}, fromBlock, toBlock],
        {
          retries: 3,
          retryDelay: 100,
          fallbackValue: [],
        },
      );
      expect(result).toEqual([...mockInsertBidEvents, ...mockDeleteBidEvents]);
    });

    it('should handle missing event types gracefully', async () => {
      // Arrange
      const contract = {
        filters: {
          InsertBid: jest.fn().mockReturnValue({}),
          // DeleteBid is missing from filters
        },
      } as unknown as ethers.Contract;
      const eventTypes = ['InsertBid', 'DeleteBid'];
      const fromBlock = 100;
      const toBlock = 105;

      const mockInsertBidEvents = [
        { eventName: 'InsertBid', blockNumber: 101, logIndex: 0 },
      ];

      jest
        .spyOn(contractCallUtil, 'safeContractCall')
        .mockResolvedValueOnce(mockInsertBidEvents);

      mockEventConfigService.getRetries.mockReturnValue(3);
      mockEventConfigService.getRetryDelay.mockReturnValue(100);

      // Act
      const result = await service['fetchEvents'](
        contract,
        eventTypes,
        fromBlock,
        toBlock,
      );

      // Assert
      expect(contract.filters.InsertBid).toHaveBeenCalled();
      expect(contractCallUtil.safeContractCall).toHaveBeenCalledTimes(1); // Only called for InsertBid
      expect(result).toEqual(mockInsertBidEvents);
    });

    it('should handle empty results and errors gracefully', async () => {
      // Arrange
      const contract = {
        filters: {
          InsertBid: jest.fn().mockReturnValue({}),
          DeleteBid: jest.fn().mockReturnValue({}),
        },
      } as unknown as ethers.Contract;
      const eventTypes = ['InsertBid', 'DeleteBid'];
      const fromBlock = 100;
      const toBlock = 105;

      // Mock safeContractCall to return empty arrays and throw an error
      jest
        .spyOn(contractCallUtil, 'safeContractCall')
        .mockResolvedValueOnce([]) // No InsertBid events
        .mockRejectedValueOnce(new Error('Network error')); // Error for DeleteBid

      mockEventConfigService.getRetries.mockReturnValue(2);
      mockEventConfigService.getRetryDelay.mockReturnValue(50);

      // Act
      const result = await service['fetchEvents'](
        contract,
        eventTypes,
        fromBlock,
        toBlock,
      );

      // Assert
      expect(contractCallUtil.safeContractCall).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]); // Should return empty array despite errors
    });
  });
});
