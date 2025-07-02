import { Test, TestingModule } from '@nestjs/testing';
import { DataProcessingService } from './data-processing.service';
import { EventProcessorService } from './services/event-processor.service';

describe('DataProcessingService', () => {
  let service: DataProcessingService;
  let mockEventProcessorService: {
    processAllEvents: jest.Mock;
    processNewEvent: jest.Mock;
  };

  beforeEach(async () => {
    mockEventProcessorService = {
      processAllEvents: jest.fn(),
      processNewEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataProcessingService,
        {
          provide: EventProcessorService,
          useValue: mockEventProcessorService,
        },
      ],
    }).compile();

    service = module.get<DataProcessingService>(DataProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAllEvents', () => {
    it('should delegate to EventProcessorService and set initial processing flag', async () => {
      // Arrange
      mockEventProcessorService.processAllEvents.mockResolvedValue(undefined);

      // Act
      await service.processAllEvents();

      // Assert
      expect(mockEventProcessorService.processAllEvents).toHaveBeenCalledTimes(
        1,
      );
      expect(service['isInitialProcessingComplete']).toBe(true);
    });

    it('should throw error when EventProcessorService fails', async () => {
      // Arrange
      const error = new Error('Processing failed');
      mockEventProcessorService.processAllEvents.mockRejectedValue(error);

      // Act & Assert
      await expect(service.processAllEvents()).rejects.toThrow(
        'Processing failed',
      );
      expect(mockEventProcessorService.processAllEvents).toHaveBeenCalledTimes(
        1,
      );
      expect(service['isInitialProcessingComplete']).toBe(false);
    });
  });

  describe('processNewEvent', () => {
    it('should delegate to EventProcessorService', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const eventId = 'test-event-id';
      mockEventProcessorService.processNewEvent.mockResolvedValue(undefined);

      // Act
      await service.processNewEvent(blockchainId, eventId);

      // Assert
      expect(mockEventProcessorService.processNewEvent).toHaveBeenCalledWith(
        blockchainId,
        eventId,
      );
    });

    it('should throw error when EventProcessorService fails', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const eventId = 'test-event-id';
      const error = new Error('Event processing failed');
      mockEventProcessorService.processNewEvent.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.processNewEvent(blockchainId, eventId),
      ).rejects.toThrow('Event processing failed');
      expect(mockEventProcessorService.processNewEvent).toHaveBeenCalledWith(
        blockchainId,
        eventId,
      );
    });
  });

  describe('handleNewBlockchainEvent', () => {
    it('should skip processing when initial processing is not complete', async () => {
      // Arrange
      const payload = {
        blockchainId: 'test-blockchain-id',
        eventId: 'test-event-id',
      };
      service['isInitialProcessingComplete'] = false;

      // Act
      await service.handleNewBlockchainEvent(payload);

      // Assert
      expect(mockEventProcessorService.processNewEvent).not.toHaveBeenCalled();
    });

    it('should process event when initial processing is complete', async () => {
      // Arrange
      const payload = {
        blockchainId: 'test-blockchain-id',
        eventId: 'test-event-id',
      };
      service['isInitialProcessingComplete'] = true;
      mockEventProcessorService.processNewEvent.mockResolvedValue(undefined);

      // Act
      await service.handleNewBlockchainEvent(payload);

      // Assert
      expect(mockEventProcessorService.processNewEvent).toHaveBeenCalledWith(
        payload.blockchainId,
        payload.eventId,
      );
    });

    it('should throw error when EventProcessorService fails', async () => {
      // Arrange
      const payload = {
        blockchainId: 'test-blockchain-id',
        eventId: 'test-event-id',
      };
      service['isInitialProcessingComplete'] = true;
      const error = new Error('Event processing failed');
      mockEventProcessorService.processNewEvent.mockRejectedValue(error);

      // Act & Assert
      await expect(service.handleNewBlockchainEvent(payload)).rejects.toThrow(
        'Event processing failed',
      );
    });
  });

  describe('onModuleInit', () => {
    it('should call processAllEvents and handle errors', async () => {
      // Arrange
      const error = new Error('Initial processing failed');
      mockEventProcessorService.processAllEvents.mockRejectedValue(error);

      // Act
      service.onModuleInit();

      // Assert
      expect(mockEventProcessorService.processAllEvents).toHaveBeenCalledTimes(
        1,
      );

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should call processAllEvents successfully', async () => {
      // Arrange
      mockEventProcessorService.processAllEvents.mockResolvedValue(undefined);

      // Act
      service.onModuleInit();

      // Assert
      expect(mockEventProcessorService.processAllEvents).toHaveBeenCalledTimes(
        1,
      );

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
