import { Test, TestingModule } from '@nestjs/testing';
import { AlertEventProcessorService } from './alert-event-processor.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Alert } from '../entities/alert.entity';
import { BlockchainEvent } from 'src/blockchains/entities/blockchain-event.entity';
import { AlertType } from '../constants';

describe('AlertEventProcessorService', () => {
  let service: AlertEventProcessorService;
  let mockAlertRepository: {
    find: jest.Mock;
  };
  let mockBlockchainEventRepository: {
    findOne: jest.Mock;
  };
  let mockAlertsQueue: {
    add: jest.Mock;
  };

  const createMockBlockchainEvent = (): BlockchainEvent =>
    ({
      id: 'event-123',
      eventName: 'DeleteBid',
      eventData: ['0x1234567890123456789012345678901234567890abcdef'],
      blockNumber: 12345,
      transactionHash: '0xabc123',
      logIndex: 0,
      isRealTime: true,
    }) as unknown as BlockchainEvent;

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.EVICTION,
      value: '10',
      isActive: true,
      userContract: {
        contract: {
          bytecode: {
            bytecodeHash: '0x1234567890123456789012345678901234567890abcdef',
          },
        },
      },
    }) as unknown as Alert;

  beforeEach(async () => {
    mockAlertRepository = {
      find: jest.fn(),
    };

    mockBlockchainEventRepository = {
      findOne: jest.fn(),
    };

    mockAlertsQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEventProcessorService,
        {
          provide: getRepositoryToken(Alert),
          useValue: mockAlertRepository,
        },
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockBlockchainEventRepository,
        },
        {
          provide: getQueueToken('alerts'),
          useValue: mockAlertsQueue,
        },
      ],
    }).compile();

    service = module.get<AlertEventProcessorService>(
      AlertEventProcessorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBlockchainEvent', () => {
    it('should process DeleteBid event successfully', async () => {
      // Arrange
      const payload = {
        blockchainId: 'blockchain-123',
        eventId: 'event-123',
      };
      const mockEvent = createMockBlockchainEvent();
      const mockAlerts = [createMockAlert()];

      mockBlockchainEventRepository.findOne
        .mockResolvedValueOnce(mockEvent) // First call for event lookup
        .mockResolvedValueOnce(mockEvent); // Second call in DeleteBid processing
      mockAlertRepository.find.mockResolvedValue(mockAlerts);
      mockAlertsQueue.add.mockResolvedValue(undefined);

      // Act
      await service.processBlockchainEvent(payload);

      // Assert
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.eventId },
      });
      expect(mockAlertRepository.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
          type: AlertType.EVICTION,
          userContract: {
            contract: { bytecode: { bytecodeHash: mockEvent.eventData[0] } },
          },
        },
      });
      expect(mockAlertsQueue.add).toHaveBeenCalledWith('alert-triggered', {
        alertId: mockAlerts[0].id,
      });
    });

    it('should handle event not found', async () => {
      // Arrange
      const payload = {
        blockchainId: 'blockchain-123',
        eventId: 'non-existent-event',
      };

      mockBlockchainEventRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.processBlockchainEvent(payload)).rejects.toThrow();
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.eventId },
      });
      expect(mockAlertRepository.find).not.toHaveBeenCalled();
      expect(mockAlertsQueue.add).not.toHaveBeenCalled();
    });

    it('should handle unknown event types gracefully', async () => {
      // Arrange
      const payload = {
        blockchainId: 'blockchain-123',
        eventId: 'event-123',
      };
      const mockEvent = {
        id: 'event-123',
        eventName: 'UnknownEvent',
        eventData: ['0x1234567890123456789012345678901234567890abcdef'],
        blockNumber: 12345,
        transactionHash: '0xabc123',
        logIndex: 0,
        isRealTime: true,
      } as unknown as BlockchainEvent;

      mockBlockchainEventRepository.findOne.mockResolvedValue(mockEvent);

      // Act
      await service.processBlockchainEvent(payload);

      // Assert
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.eventId },
      });
      // Should process the event (not throw) but use default processor
    });

    it('should handle no alerts found for DeleteBid event', async () => {
      // Arrange
      const payload = {
        blockchainId: 'blockchain-123',
        eventId: 'event-123',
      };
      const mockEvent = createMockBlockchainEvent();

      mockBlockchainEventRepository.findOne
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockEvent);
      mockAlertRepository.find.mockResolvedValue([]); // No alerts found

      // Act
      await service.processBlockchainEvent(payload);

      // Assert
      expect(mockAlertRepository.find).toHaveBeenCalled();
      expect(mockAlertsQueue.add).not.toHaveBeenCalled();
    });
  });
});
