import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DecayRateService } from './decay-rate.service';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { EVENT_TYPES } from '../constants/event-processing.constants';
import { QueryRunner } from 'typeorm';

describe('DecayRateService', () => {
  let service: DecayRateService;

  beforeEach(async () => {
    const mockRepositories = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecayRateService,
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockRepositories,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockRepositories,
        },
      ],
    }).compile();

    service = module.get<DecayRateService>(DecayRateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractDecayRateEvents', () => {
    it('should extract decay rate events successfully', () => {
      // Arrange
      const mockEvents = [
        {
          eventName: EVENT_TYPES.SET_DECAY_RATE,
          eventData: ['100'],
          blockNumber: 101,
          logIndex: 0,
          blockTimestamp: new Date(),
        },
        {
          eventName: EVENT_TYPES.INSERT_BID,
          eventData: ['0x123', '0x456', '1000', '1024'],
          blockNumber: 102,
          logIndex: 0,
          blockTimestamp: new Date(),
        },
      ] as unknown as BlockchainEvent[];

      // Act
      const result = service.extractDecayRateEvents(mockEvents);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].decayRate).toBe('100');
      expect(result[0].blockNumber).toBe(101);
    });

    it('should handle empty events array', () => {
      // Arrange
      const mockEvents: BlockchainEvent[] = [];

      // Act
      const result = service.extractDecayRateEvents(mockEvents);

      // Assert
      expect(result.length).toBe(0);
    });

    it('should handle invalid event data', () => {
      // Arrange
      const mockEvents = [
        {
          eventName: EVENT_TYPES.SET_DECAY_RATE,
          eventData: [], // Invalid data
          blockNumber: 101,
          logIndex: 0,
          blockTimestamp: new Date(),
        },
      ] as unknown as BlockchainEvent[];

      // Act
      const result = service.extractDecayRateEvents(mockEvents);

      // Assert
      expect(result.length).toBe(0);
    });
  });

  describe('getLatestBlockchainState', () => {
    it('should return blockchain state when found', async () => {
      // Arrange
      const mockQueryRunner = {
        query: jest.fn().mockResolvedValue([
          {
            id: 'state-id',
            blockchainId: 'blockchain-id',
            blockNumber: 101,
            decayRate: '1000000000000000',
          },
        ]),
        // Add minimal required properties
        manager: {},
        connection: {},
        isTransactionActive: false,
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        isReleased: false,
      } as unknown as jest.Mocked<QueryRunner>;
      const blockchainId = 'blockchain-id';

      // Act
      const result = await service.getLatestBlockchainState(
        blockchainId,
        mockQueryRunner,
      );

      // Assert
      expect(result).not.toBeNull();
      expect(result?.blockchainId).toBe('blockchain-id');
      expect(result?.blockNumber).toBe(101);
      expect(mockQueryRunner.query.mock.calls.length).toBe(1);
      expect(mockQueryRunner.query.mock.lastCall?.[0]).toContain(
        'SELECT * FROM blockchain_state',
      );
      expect(mockQueryRunner.query.mock.lastCall?.[1]).toEqual([blockchainId]);
    });

    it('should return null when no blockchain state found', async () => {
      // Arrange
      const mockQueryRunner = {
        query: jest.fn().mockResolvedValue([]),
        // Add minimal required properties
        manager: {},
        connection: {},
        isTransactionActive: false,
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        isReleased: false,
      } as unknown as jest.Mocked<QueryRunner>;
      const blockchainId = 'blockchain-id';

      // Act
      const result = await service.getLatestBlockchainState(
        blockchainId,
        mockQueryRunner,
      );

      // Assert
      expect(result).toBeNull();
      expect(mockQueryRunner.query.mock.calls.length).toBe(1);
      expect(mockQueryRunner.query.mock.lastCall?.[0]).toContain(
        'SELECT * FROM blockchain_state',
      );
      expect(mockQueryRunner.query.mock.lastCall?.[1]).toEqual([blockchainId]);
    });
  });
});
