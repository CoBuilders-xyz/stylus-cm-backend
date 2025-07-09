import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessorService } from './event-processor.service';
import { EventStorageService } from './event-storage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlockchainEvent } from '../../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { ethers } from 'ethers';

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  let mockEventStorageService: {
    prepareEvents: jest.Mock;
    storeEvents: jest.Mock;
    updateLastSyncedBlock: jest.Mock;
  };
  let mockEventEmitter: {
    emit: jest.Mock;
  };
  let mockBlockchainEventRepository: {
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

  beforeEach(async () => {
    mockEventStorageService = {
      prepareEvents: jest.fn(),
      storeEvents: jest.fn(),
      updateLastSyncedBlock: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockBlockchainEventRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        { provide: EventStorageService, useValue: mockEventStorageService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockBlockchainEventRepository,
        },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processEvent', () => {
    it('should process a new event successfully', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const provider = {} as ethers.JsonRpcProvider;
      const eventLog = {
        blockNumber: 12345,
        index: 0,
        transactionHash: '0xabc123',
        address: blockchain.cacheManagerAddress,
        topics: ['0xevent_signature'],
        data: '0xevent_data',
      } as unknown as ethers.Log;
      const eventType = 'InsertBid';
      const eventData = { bidder: '0x123', amount: '1000' };

      // Mock successful storage
      const preparedEvents = [{ blockchain, eventType, blockNumber: 12345 }];
      mockEventStorageService.prepareEvents.mockResolvedValue(preparedEvents);
      mockEventStorageService.storeEvents.mockResolvedValue(undefined);
      mockEventStorageService.updateLastSyncedBlock.mockResolvedValue(
        undefined,
      );

      // Mock the stored event lookup in emitEventStored
      mockBlockchainEventRepository.findOne
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce({ id: 123 }); // Second call in emitEventStored
      mockEventEmitter.emit.mockResolvedValue(undefined);

      // Act
      await service.processEvent(
        blockchain,
        eventLog,
        provider,
        eventType,
        eventData,
      );

      // Assert
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockEventStorageService.prepareEvents).toHaveBeenCalledWith(
        blockchain,
        [eventLog],
        provider,
        true, // isRealTime
        eventType,
        eventData,
      );
      expect(mockEventStorageService.storeEvents).toHaveBeenCalledWith(
        preparedEvents,
      );
      expect(
        mockEventStorageService.updateLastSyncedBlock,
      ).toHaveBeenCalledWith(blockchain, eventLog.blockNumber);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'blockchain.event.stored',
        {
          blockchainId: blockchain.id,
          eventId: 123,
        },
      );
    });

    it('should skip duplicate events', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const provider = {} as ethers.JsonRpcProvider;
      const eventLog = {
        blockNumber: 12345,
        index: 0,
        transactionHash: '0xabc123',
        address: blockchain.cacheManagerAddress,
        topics: ['0xevent_signature'],
        data: '0xevent_data',
      } as unknown as ethers.Log;
      const eventType = 'InsertBid';

      // Mock duplicate found
      mockBlockchainEventRepository.findOne.mockResolvedValue({ id: 1 });

      // Act
      await service.processEvent(blockchain, eventLog, provider, eventType);

      // Assert
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalled();
      expect(mockEventStorageService.prepareEvents).not.toHaveBeenCalled();
      expect(mockEventStorageService.storeEvents).not.toHaveBeenCalled();
      expect(
        mockEventStorageService.updateLastSyncedBlock,
      ).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
