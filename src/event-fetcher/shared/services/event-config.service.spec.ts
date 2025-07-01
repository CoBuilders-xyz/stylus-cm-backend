import { Test, TestingModule } from '@nestjs/testing';
import { EventConfigService } from './event-config.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Blockchain } from '../../../blockchains/entities/blockchain.entity';
import { ConfigService } from '@nestjs/config';
import { EventFetcherConfig } from '../interfaces/config.interface';

describe('EventConfigService', () => {
  let service: EventConfigService;
  let mockBlockchainRepository: Record<string, unknown>;
  let mockConfigService: { get: jest.Mock<any, [string]> };

  beforeEach(async () => {
    mockBlockchainRepository = {};
    mockConfigService = {
      get: jest.fn<any, [string]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventConfigService,
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EventConfigService>(EventConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventFetcherConfig', () => {
    it('should return default config when no config is provided', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);

      // Act
      const config = service.getEventFetcherConfig();

      // Assert
      expect(config).toEqual({
        resyncBlocksBack: 100,
        eventTypes: [
          'InsertBid',
          'DeleteBid',
          'Pause',
          'Unpause',
          'SetCacheSize',
          'SetDecayRate',
          'Initialized',
        ],
        batchSize: 50,
        retries: 3,
        retryDelay: 2000,
      });
    });

    it('should merge provided config with defaults', () => {
      // Arrange
      const partialConfig: Partial<EventFetcherConfig> = {
        batchSize: 10,
        retries: 5,
      };
      mockConfigService.get.mockReturnValue(partialConfig);

      // Act
      const config = service.getEventFetcherConfig();

      // Assert
      expect(config.batchSize).toBe(10);
      expect(config.retries).toBe(5);
      expect(config.resyncBlocksBack).toBe(100); // default
      expect(config.eventTypes).toContain('InsertBid'); // default
      expect(config.retryDelay).toBe(2000); // default
    });
  });
});
