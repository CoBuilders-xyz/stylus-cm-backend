import { Test, TestingModule } from '@nestjs/testing';
import { EventStorageService } from './event-storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockchainEvent } from '../../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { EventConfigService } from './event-config.service';
import { BlockchainEventData } from '../interfaces/event.interface';

describe('EventStorageService', () => {
  let service: EventStorageService;
  let mockEventRepository: {
    manager: {
      connection: {
        createQueryRunner: () => MockQueryRunner;
      };
    };
  };
  let mockBlockchainRepository: Record<string, unknown>;
  let mockEventConfigService: {
    getBatchSize: jest.Mock<number, []>;
  };

  type MockQueryRunner = {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      insert: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockQueryRunner: MockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        insert: jest.fn(),
      },
    };
    mockEventRepository = {
      manager: {
        connection: {
          createQueryRunner: () => mockQueryRunner,
        },
      },
    };
    mockBlockchainRepository = {};
    mockEventConfigService = {
      getBatchSize: jest.fn(() => 2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStorageService,
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
        { provide: EventConfigService, useValue: mockEventConfigService },
      ],
    }).compile();

    service = module.get<EventStorageService>(EventStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeEvents', () => {
    it('should insert all events and return correct counts', async () => {
      // Arrange
      const blockchain: Blockchain = {
        id: 'test-blockchain-id',
        name: 'Test Blockchain',
        chainId: 12345,
        rpcUrl: 'https://test-rpc.com',
        fastSyncRpcUrl: 'https://test-fast-rpc.com',
        rpcWssUrl: 'wss://test-ws.com',
        cacheManagerAddress: '0x1234567890123456789012345678901234567890',
        rpcUrlBackup: 'https://test-rpc-backup.com',
        rpcWssUrlBackup: 'wss://test-ws-backup.com',
        cacheManagerAutomationAddress:
          '0x0987654321098765432109876543210987654321',
        arbWasmCacheAddress: '0x1111111111111111111111111111111111111111',
        arbWasmAddress: '0x2222222222222222222222222222222222222222',
        originBlock: 0,
        lastSyncedBlock: 0,
        lastProcessedBlockNumber: 0,
        enabled: true,
      };
      const now = new Date();
      const events: BlockchainEventData[] = [
        {
          blockchain,
          contractName: 'CacheManager',
          contractAddress: blockchain.cacheManagerAddress,
          eventName: 'InsertBid',
          blockTimestamp: now,
          blockNumber: 1,
          transactionHash: '0x1',
          logIndex: 0,
          isRealTime: true,
          eventData: {},
        },
        {
          blockchain,
          contractName: 'CacheManager',
          contractAddress: blockchain.cacheManagerAddress,
          eventName: 'DeleteBid',
          blockTimestamp: now,
          blockNumber: 2,
          transactionHash: '0x2',
          logIndex: 1,
          isRealTime: false,
          eventData: {},
        },
      ];
      const mockQueryRunner =
        mockEventRepository.manager.connection.createQueryRunner();
      mockQueryRunner.manager.insert.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.release.mockResolvedValue(undefined);

      // Act
      const result = await service.storeEvents(events);

      // Assert
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        successCount: 2,
        errorCount: 0,
        totalEvents: 2,
      });
    });
  });
});
