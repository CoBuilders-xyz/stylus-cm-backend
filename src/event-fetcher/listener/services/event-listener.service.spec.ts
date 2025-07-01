import { Test, TestingModule } from '@nestjs/testing';
import { EventListenerService } from './event-listener.service';
import { WebSocketManagerService } from './websocket-manager.service';
import { ListenerStateService } from './listener-state.service';
import { EventProcessorService } from '../../shared';
import { EventQueueService } from './event-queue.service';
import { ReconnectionHandlerService } from './reconnection-handler.service';
import { ProviderManager } from '../../../common/utils/provider.util';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';

describe('EventListenerService', () => {
  let service: EventListenerService;
  let mockWebSocketManager: {
    validateWebSocketConfig: jest.Mock;
    createWebSocketContracts: jest.Mock;
  };
  let mockListenerState: {
    markSettingUpListener: jest.Mock;
    storeBlockchainConfig: jest.Mock;
    setListenerActive: jest.Mock;
    clearListener: jest.Mock;
    removeBlockchainConfig: jest.Mock;
    isEventProcessing: jest.Mock;
  };
  let mockEventProcessor: {
    processEvent: jest.Mock;
  };
  let mockEventQueueService: {
    addToQueue: jest.Mock;
    enqueueEvent: jest.Mock;
  };
  let mockReconnectionHandler: {
    registerCallbacks: jest.Mock;
  };
  let mockProviderManager: {
    registerReconnectionCallback: jest.Mock;
    unregisterReconnectionCallback: jest.Mock;
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
    mockWebSocketManager = {
      validateWebSocketConfig: jest.fn(),
      createWebSocketContracts: jest.fn(),
    };

    mockListenerState = {
      markSettingUpListener: jest.fn(),
      storeBlockchainConfig: jest.fn(),
      setListenerActive: jest.fn(),
      clearListener: jest.fn(),
      removeBlockchainConfig: jest.fn(),
      isEventProcessing: jest.fn(),
    };

    mockEventProcessor = {
      processEvent: jest.fn(),
    };

    mockEventQueueService = {
      addToQueue: jest.fn(),
      enqueueEvent: jest.fn(),
    };

    mockReconnectionHandler = {
      registerCallbacks: jest.fn(),
    };

    mockProviderManager = {
      registerReconnectionCallback: jest.fn(),
      unregisterReconnectionCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventListenerService,
        {
          provide: WebSocketManagerService,
          useValue: mockWebSocketManager,
        },
        {
          provide: ListenerStateService,
          useValue: mockListenerState,
        },
        {
          provide: EventProcessorService,
          useValue: mockEventProcessor,
        },
        {
          provide: EventQueueService,
          useValue: mockEventQueueService,
        },
        {
          provide: ReconnectionHandlerService,
          useValue: mockReconnectionHandler,
        },
        {
          provide: ProviderManager,
          useValue: mockProviderManager,
        },
      ],
    }).compile();

    service = module.get<EventListenerService>(EventListenerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // BASIC SERVICE TESTS
  describe('Basic Service Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should register reconnection callbacks on construction', () => {
      expect(mockReconnectionHandler.registerCallbacks).toHaveBeenCalled();
      expect(
        mockProviderManager.registerReconnectionCallback,
      ).toHaveBeenCalled();
    });
  });

  // CLEAR ACTIVE LISTENER TESTS
  describe('clearActiveListener', () => {
    it('should clear listener state for given blockchain', () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';

      // Act
      service.clearActiveListener(blockchainId);

      // Assert
      expect(mockListenerState.clearListener).toHaveBeenCalledWith(
        blockchainId,
      );
    });
  });

  // RESTART EVENT LISTENERS TESTS
  describe('restartEventListeners', () => {
    it('should restart event listeners for a blockchain', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const eventTypes = ['InsertBid', 'DeleteBid'];

      // Mock the setupEventListeners method (we'll test this separately)
      const setupSpy = jest
        .spyOn(service, 'setupEventListeners')
        .mockResolvedValue();

      // Act
      await service.restartEventListeners(blockchain, eventTypes);

      // Assert
      expect(mockListenerState.clearListener).toHaveBeenCalledWith(
        blockchain.id,
      );
      expect(mockListenerState.removeBlockchainConfig).toHaveBeenCalledWith(
        blockchain.id,
      );
      expect(setupSpy).toHaveBeenCalledWith(blockchain, eventTypes);

      // Cleanup
      setupSpy.mockRestore();
    });
  });

  describe('setupEventListeners', () => {
    it('should successfully setup event listeners for valid blockchain configuration', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const eventTypes = ['InsertBid', 'DeleteBid'];

      // Mock successful validation
      mockWebSocketManager.validateWebSocketConfig.mockReturnValue(true);

      // Mock successful state marking
      mockListenerState.markSettingUpListener.mockReturnValue(true);

      // Mock WebSocket contracts
      const mockContracts = {
        cacheManagerContract: {
          removeAllListeners: jest.fn().mockResolvedValue(undefined),
          on: jest.fn().mockResolvedValue(undefined),
        },
        cacheManagerAutomationContract: {
          removeAllListeners: jest.fn().mockResolvedValue(undefined),
          on: jest.fn().mockResolvedValue(undefined),
        },
      };
      mockWebSocketManager.createWebSocketContracts.mockReturnValue(
        mockContracts,
      );

      // Act
      await service.setupEventListeners(blockchain, eventTypes);

      // Assert
      expect(mockWebSocketManager.validateWebSocketConfig).toHaveBeenCalledWith(
        blockchain,
      );
      expect(mockListenerState.markSettingUpListener).toHaveBeenCalledWith(
        blockchain.id,
      );
      expect(mockListenerState.storeBlockchainConfig).toHaveBeenCalledWith(
        blockchain.id,
        {
          blockchain,
          eventTypes,
        },
      );
      expect(
        mockWebSocketManager.createWebSocketContracts,
      ).toHaveBeenCalledWith(blockchain);
      expect(mockListenerState.setListenerActive).toHaveBeenCalledWith(
        blockchain.id,
      );
    });

    it('should setup event handlers and process events correctly', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const eventTypes = ['InsertBid', 'DeleteBid'];

      // Mock successful validation and state
      mockWebSocketManager.validateWebSocketConfig.mockReturnValue(true);
      mockListenerState.markSettingUpListener.mockReturnValue(true);
      mockListenerState.isEventProcessing.mockReturnValue(false);

      // Create a contract mock that verifies the event handler is registered
      const mockContract = {
        removeAllListeners: jest.fn().mockResolvedValue(undefined),
        on: jest.fn().mockResolvedValue(undefined),
      };

      const mockContracts = {
        cacheManagerContract: mockContract,
        cacheManagerAutomationContract: mockContract,
      };
      mockWebSocketManager.createWebSocketContracts.mockReturnValue(
        mockContracts,
      );

      // Act - Setup the listeners
      await service.setupEventListeners(blockchain, eventTypes);

      // Assert - Verify the event handlers were registered for both contracts
      expect(mockContract.on).toHaveBeenCalledTimes(2); // Called for both contracts
      expect(mockContract.on).toHaveBeenCalledWith('*', expect.any(Function));

      // Verify the contracts were properly configured
      expect(mockContract.removeAllListeners).toHaveBeenCalledTimes(2);
      expect(
        mockWebSocketManager.createWebSocketContracts,
      ).toHaveBeenCalledWith(blockchain);
      expect(mockListenerState.setListenerActive).toHaveBeenCalledWith(
        blockchain.id,
      );
    });
  });
});
