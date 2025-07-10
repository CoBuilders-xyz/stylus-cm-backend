import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventProcessorService } from './event-processor.service';
import { InsertBidService } from './insert-bid.service';
import { DeleteBidService } from './delete-bid.service';
import { DecayRateService } from './decay-rate.service';
import { ContractBytecodeService } from './contract-bytecode.service';
import { AutomationService } from './automation.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  let mockBlockchainRepository: jest.Mocked<Repository<Blockchain>>;
  let mockBlockchainEventRepository: jest.Mocked<Repository<BlockchainEvent>>;
  let mockInsertBidService: jest.Mocked<InsertBidService>;

  beforeEach(async () => {
    const mockRepositories = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockServices = {
      processInsertBidEvent: jest.fn(),
      processDeleteBidEvent: jest.fn(),
      processContractAddedEvent: jest.fn(),
      processContractUpdatedEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockRepositories,
        },
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockRepositories,
        },
        {
          provide: InsertBidService,
          useValue: mockServices,
        },
        {
          provide: DeleteBidService,
          useValue: mockServices,
        },
        {
          provide: DecayRateService,
          useValue: mockServices,
        },
        {
          provide: ContractBytecodeService,
          useValue: mockServices,
        },
        {
          provide: AutomationService,
          useValue: mockServices,
        },
        {
          provide: DataSource,
          useValue: mockRepositories,
        },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
    mockBlockchainRepository = module.get(getRepositoryToken(Blockchain));
    mockBlockchainEventRepository = module.get(
      getRepositoryToken(BlockchainEvent),
    );
    mockInsertBidService = module.get(InsertBidService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAllEvents', () => {
    it('should process all events successfully', async () => {
      // Arrange
      const mockBlockchain = {
        id: 'test-id',
        name: 'Test',
        enabled: true,
        lastProcessedBlockNumber: 0,
      } as Blockchain;
      const mockEvent = {
        id: 'event-id',
        eventName: 'InsertBid',
        blockNumber: 1,
        logIndex: 0,
      } as BlockchainEvent;

      mockBlockchainRepository.find.mockResolvedValue([mockBlockchain]);
      mockBlockchainEventRepository.find.mockResolvedValue([mockEvent]);
      mockInsertBidService.processInsertBidEvent.mockResolvedValue();

      // Act
      await service.processAllEvents();

      // Assert
      expect(mockBlockchainRepository.find.mock.calls.length).toBeGreaterThan(
        0,
      );
      expect(
        mockBlockchainEventRepository.find.mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should handle no enabled blockchains', async () => {
      // Arrange
      mockBlockchainRepository.find.mockResolvedValue([]);

      // Act
      await service.processAllEvents();

      // Assert
      expect(mockBlockchainRepository.find.mock.calls.length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('processNewEvent', () => {
    it('should throw error when blockchain not found', async () => {
      // Arrange
      const blockchainId = 'blockchain-id';
      const eventId = 'event-id';

      mockBlockchainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.processNewEvent(blockchainId, eventId),
      ).rejects.toThrow();
    });

    it('should throw error when event not found', async () => {
      // Arrange
      const blockchainId = 'blockchain-id';
      const eventId = 'event-id';
      const mockBlockchain = {
        id: blockchainId,
        name: 'Test Blockchain',
      } as Blockchain;

      mockBlockchainRepository.findOne.mockResolvedValue(mockBlockchain);
      mockBlockchainEventRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.processNewEvent(blockchainId, eventId),
      ).rejects.toThrow();
    });
  });
});
