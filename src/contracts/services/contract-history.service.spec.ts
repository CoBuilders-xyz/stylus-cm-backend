import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractHistoryService } from './contract-history.service';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';

describe('ContractHistoryService', () => {
  let service: ContractHistoryService;
  let mockBlockchainEventRepository: {
    createQueryBuilder: jest.Mock;
  };
  let mockContractBidCalculatorService: {
    getDecayRate: jest.Mock;
    calculateEffectiveBid: jest.Mock;
  };

  beforeEach(async () => {
    // Create repository mock
    mockBlockchainEventRepository = {
      createQueryBuilder: jest.fn(),
    };

    // Create service mock
    mockContractBidCalculatorService = {
      getDecayRate: jest.fn(),
      calculateEffectiveBid: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractHistoryService,
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockBlockchainEventRepository,
        },
        {
          provide: ContractBidCalculatorService,
          useValue: mockContractBidCalculatorService,
        },
      ],
    }).compile();

    service = module.get<ContractHistoryService>(ContractHistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActivationHistory', () => {
    const contractAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
    const blockchainId = 'blockchain-one';

    const buildQueryBuilder = (events: unknown[]) => ({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(events),
    });

    it('scopes the query to the given blockchain and lowercases the address', async () => {
      const qb = buildQueryBuilder([]);
      mockBlockchainEventRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getActivationHistory(
        contractAddress,
        blockchainId,
      );

      expect(result).toEqual([]);
      expect(qb.innerJoin).toHaveBeenCalledWith(
        'event.blockchain',
        'blockchain',
      );
      expect(qb.where).toHaveBeenCalledWith('blockchain.id = :blockchainId', {
        blockchainId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'event.eventName IN (:...eventNames)',
        { eventNames: ['ActivationPerformed', 'ActivationError'] },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(CAST(event."eventData"->>1 AS TEXT))'),
        { contractAddress: contractAddress.toLowerCase() },
      );
    });

    it('maps ActivationPerformed and ActivationError events', async () => {
      const timestamp = new Date('2026-09-10T00:00:00Z');
      const qb = buildQueryBuilder([
        {
          eventName: 'ActivationPerformed',
          blockTimestamp: timestamp,
          blockNumber: 100,
          transactionHash: '0xperformed',
          eventData: ['0xuser', contractAddress, '3', '10', '8', '2', '90'],
        },
        {
          eventName: 'ActivationError',
          blockTimestamp: timestamp,
          blockNumber: 99,
          transactionHash: '0xerror',
          eventData: ['0xuser', contractAddress, '10', 'Insufficient balance'],
        },
      ]);
      mockBlockchainEventRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getActivationHistory(
        contractAddress,
        blockchainId,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        eventType: 'ActivationPerformed',
        user: '0xuser',
        contractAddress,
        blockNumber: 100,
        transactionHash: '0xperformed',
        version: '3',
        dataFee: '10',
        spent: '8',
        refund: '2',
        userBalance: '90',
      });
      expect(result[1]).toMatchObject({
        eventType: 'ActivationError',
        transactionHash: '0xerror',
        reason: 'Insufficient balance',
      });
    });

    it('returns an empty list when the query fails', async () => {
      const qb = buildQueryBuilder([]);
      qb.getMany.mockRejectedValue(new Error('db down'));
      mockBlockchainEventRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.getActivationHistory(contractAddress, blockchainId),
      ).resolves.toEqual([]);
    });
  });

  describe('getBiddingHistory', () => {
    it('should get bidding history for a contract address', async () => {
      // Arrange
      const contractAddress = '0x1234567890123456789012345678901234567890';

      const mockInsertBidEvents = [
        {
          id: 'event-1',
          eventName: 'InsertBid',
          blockTimestamp: new Date('2023-01-01T12:00:00Z'),
          blockNumber: 12345,
          transactionHash: '0xabc123',
          logIndex: 0,
          eventData: [
            '0x123456', // bytecodeHash
            contractAddress.toLowerCase(),
            '2000000', // bid
            '1024', // size
          ],
          originAddress: '0x9876543210987654321098765432109876543210',
          contractName: 'CacheManager',
          blockchain: {
            id: 'arbitrum-sepolia',
          },
        },
        {
          id: 'event-2',
          eventName: 'InsertBid',
          blockTimestamp: new Date('2023-01-01T10:00:00Z'),
          blockNumber: 12300,
          transactionHash: '0xdef456',
          logIndex: 1,
          eventData: [
            '0x789012',
            contractAddress.toLowerCase(),
            '1500000',
            '1024',
          ],
          originAddress: '0x1111222233334444555566667777888899990000',
          contractName: 'CacheManager',
          blockchain: {
            id: 'arbitrum-sepolia',
          },
        },
      ];

      const mockAutomationEvents = [
        {
          id: 'auto-event-1',
          eventName: 'BidPlaced',
          transactionHash: '0xabc123',
          eventData: [
            '0x9876543210987654321098765432109876543210', // user
            contractAddress.toLowerCase(),
            '2000000', // bidAmount
            '1000000', // minBid
            '5000000', // maxBid
            '10000000', // userBalance
          ],
        },
      ];

      // Mock QueryBuilder chain
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };

      // Setup the first query (InsertBid events) to return mockInsertBidEvents
      // Setup the second query (BidPlaced events) to return mockAutomationEvents
      mockBlockchainEventRepository.createQueryBuilder
        .mockReturnValueOnce({
          ...mockQueryBuilder,
          getMany: jest.fn().mockResolvedValue(mockInsertBidEvents),
        })
        .mockReturnValueOnce({
          ...mockQueryBuilder,
          getMany: jest.fn().mockResolvedValue(mockAutomationEvents),
        });

      // Mock the bid calculator service
      mockContractBidCalculatorService.getDecayRate.mockResolvedValue('100');
      mockContractBidCalculatorService.calculateEffectiveBid.mockReturnValue(
        '1900000',
      );

      // Act
      const result = await service.getBiddingHistory(contractAddress);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      // Check that we have history items with basic structure
      expect(result[0]).toBeDefined();
      expect(result[0].bytecodeHash).toBe('0x123456');
      expect(result[0].contractAddress).toBe(contractAddress.toLowerCase());
      expect(result[0].actualBid).toBe('1900000');
      expect(result[0].size).toBe('1024');
      expect(result[0].transactionHash).toBe('0xabc123');

      // Check second history item
      expect(result[1]).toBeDefined();
      expect(result[1].bytecodeHash).toBe('0x789012');
      expect(result[1].contractAddress).toBe(contractAddress.toLowerCase());
      expect(result[1].actualBid).toBe('1900000');
      expect(result[1].size).toBe('1024');
      expect(result[1].transactionHash).toBe('0xdef456');

      // Verify repository method calls
      expect(
        mockBlockchainEventRepository.createQueryBuilder,
      ).toHaveBeenCalledTimes(2);

      // Verify bid calculator service calls
      expect(
        mockContractBidCalculatorService.getDecayRate,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockContractBidCalculatorService.calculateEffectiveBid,
      ).toHaveBeenCalledTimes(2);
    });

    it('should handle empty bidding history', async () => {
      // Arrange
      const contractAddress = '0x1234567890123456789012345678901234567890';

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockBlockchainEventRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      // Act
      const result = await service.getBiddingHistory(contractAddress);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle invalid contract address', async () => {
      // Arrange
      const invalidAddress = 'invalid-address';

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockBlockchainEventRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      // Act & Assert
      // The service should still work but return empty results for invalid addresses
      const result = await service.getBiddingHistory(invalidAddress);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
