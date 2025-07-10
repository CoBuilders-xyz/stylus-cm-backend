import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractBidCalculatorService } from './contract-bid-calculator.service';
import { BlockchainState } from '../../blockchains/entities/blockchain-state.entity';
import { BlockchainEvent } from '../../blockchains/entities/blockchain-event.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { Contract } from '../entities/contract.entity';

describe('ContractBidCalculatorService', () => {
  let service: ContractBidCalculatorService;
  let mockBlockchainStateRepository: { findOne: jest.Mock };
  let mockBlockchainEventRepository: { findOne: jest.Mock };
  let mockBlockchainRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    // Create repository mocks
    mockBlockchainStateRepository = {
      findOne: jest.fn(),
    };

    mockBlockchainEventRepository = {
      findOne: jest.fn(),
    };

    mockBlockchainRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractBidCalculatorService,
        {
          provide: getRepositoryToken(BlockchainState),
          useValue: mockBlockchainStateRepository,
        },
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockBlockchainEventRepository,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
      ],
    }).compile();

    service = module.get<ContractBidCalculatorService>(
      ContractBidCalculatorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateEffectiveBid', () => {
    it('should calculate effective bid correctly', () => {
      // Arrange
      const startTimestamp = new Date('2023-01-01T00:00:00Z');
      const endTimestamp = new Date('2023-01-01T01:00:00Z'); // 1 hour later
      const bidSize = '1000000'; // 1M wei
      const decayRate = '100'; // 100 wei per second

      // Act
      const result = service.calculateEffectiveBid(
        startTimestamp,
        endTimestamp,
        bidSize,
        decayRate,
      );

      // Assert
      // Time elapsed = 3600 seconds
      // Decay amount = 3600 * 100 = 360000
      // Effective bid = 1000000 - 360000 = 640000
      expect(result).toBe('640000');
    });

    it('should return 0 when decay exceeds bid size', () => {
      // Arrange
      const startTimestamp = new Date('2023-01-01T00:00:00Z');
      const endTimestamp = new Date('2023-01-01T10:00:00Z'); // 10 hours later
      const bidSize = '1000000'; // 1M wei
      const decayRate = '1000'; // 1000 wei per second

      // Act
      const result = service.calculateEffectiveBid(
        startTimestamp,
        endTimestamp,
        bidSize,
        decayRate,
      );

      // Assert
      // Time elapsed = 36000 seconds
      // Decay amount = 36000 * 1000 = 36000000 > 1000000
      // Effective bid = 0
      expect(result).toBe('0');
    });

    it('should handle zero decay rate', () => {
      // Arrange
      const startTimestamp = new Date('2023-01-01T00:00:00Z');
      const endTimestamp = new Date('2023-01-01T01:00:00Z');
      const bidSize = '1000000';
      const decayRate = '0';

      // Act
      const result = service.calculateEffectiveBid(
        startTimestamp,
        endTimestamp,
        bidSize,
        decayRate,
      );

      // Assert
      expect(result).toBe('1000000');
    });
  });

  describe('getDecayRate', () => {
    it('should get decay rate from blockchain event', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const timestamp = new Date('2023-01-01T12:00:00Z');
      const mockEvent = {
        eventData: ['500'], // decay rate in event data
      };

      mockBlockchainEventRepository.findOne.mockResolvedValue(mockEvent);

      // Act
      const result = await service.getDecayRate(blockchainId, timestamp);

      // Assert
      expect(result).toBe('500');
      expect(mockBlockchainEventRepository.findOne).toHaveBeenCalledWith({
        where: {
          blockchain: { id: blockchainId },
          eventName: 'SetDecayRate',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          blockTimestamp: expect.any(Object),
        },
        order: { blockTimestamp: 'DESC' },
      });
    });

    it('should fallback to blockchain state when no event found', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const timestamp = new Date('2023-01-01T12:00:00Z');
      const mockState = {
        decayRate: '750',
      };

      mockBlockchainEventRepository.findOne.mockResolvedValue(null);
      mockBlockchainStateRepository.findOne.mockResolvedValue(mockState);

      // Act
      const result = await service.getDecayRate(blockchainId, timestamp);

      // Assert
      expect(result).toBe('750');
      expect(mockBlockchainStateRepository.findOne).toHaveBeenCalledWith({
        where: { blockchain: { id: blockchainId } },
        order: { blockNumber: 'DESC' },
      });
    });

    it('should return 0 when no data found', async () => {
      // Arrange
      const blockchainId = 'test-blockchain-id';
      const timestamp = new Date('2023-01-01T12:00:00Z');

      mockBlockchainEventRepository.findOne.mockResolvedValue(null);
      mockBlockchainStateRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getDecayRate(blockchainId, timestamp);

      // Assert
      expect(result).toBe('0');
    });
  });

  describe('calculateCurrentContractEffectiveBid', () => {
    it('should calculate current effective bid for a contract', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: {
          lastBid: '2000000',
          bidBlockTimestamp: new Date('2023-01-01T00:00:00Z'),
        },
      } as Contract;

      // Mock getDecayRate to return a specific value
      const getDecayRateSpy = jest
        .spyOn(service, 'getDecayRate')
        .mockImplementation(() => Promise.resolve('200'));

      // Mock calculateEffectiveBid to return a specific value
      const calculateEffectiveBidSpy = jest
        .spyOn(service, 'calculateEffectiveBid')
        .mockImplementation(() => '1800000');

      // Act
      const result =
        await service.calculateCurrentContractEffectiveBid(mockContract);

      // Assert
      expect(result).toBe('1800000');
      expect(getDecayRateSpy).toHaveBeenCalledWith(
        'test-blockchain-id',
        expect.any(Date),
      );
      expect(calculateEffectiveBidSpy).toHaveBeenCalledWith(
        mockContract.bytecode.bidBlockTimestamp,
        expect.any(Date),
        '2000000',
        '200',
      );

      // Cleanup spies
      getDecayRateSpy.mockRestore();
      calculateEffectiveBidSpy.mockRestore();
    });

    it('should throw error when contract has no bytecode', async () => {
      // Arrange
      const mockContract = {
        id: 'test-contract-id',
        blockchain: { id: 'test-blockchain-id' },
        bytecode: null,
      } as unknown as Contract;

      // Act & Assert
      await expect(
        service.calculateCurrentContractEffectiveBid(mockContract),
      ).rejects.toThrow();
    });
  });
});
