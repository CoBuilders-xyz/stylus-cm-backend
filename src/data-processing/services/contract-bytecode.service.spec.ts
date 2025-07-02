import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractBytecodeService } from './contract-bytecode.service';
import { Bytecode } from '../../contracts/entities/bytecode.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { ContractBytecodeState } from '../interfaces/contract-bytecode-state.interface';

describe('ContractBytecodeService', () => {
  let service: ContractBytecodeService;
  let mockBytecodeRepository: jest.Mocked<Repository<Bytecode>>;

  beforeEach(async () => {
    const mockBytecodeRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractBytecodeService,
        {
          provide: getRepositoryToken(Bytecode),
          useValue: mockBytecodeRepo,
        },
      ],
    }).compile();

    service = module.get<ContractBytecodeService>(ContractBytecodeService);
    mockBytecodeRepository = module.get(getRepositoryToken(Bytecode));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateContractBytecodes', () => {
    it('should update existing bytecodes successfully', async () => {
      // Arrange
      const mockBlockchain = {
        id: 'blockchain-id',
        name: 'Test Blockchain',
      } as Blockchain;

      const mockBytecode = {
        id: 'bytecode-id',
        bytecodeHash: '0x123456789abcdef',
        isCached: false,
        lastBid: '0',
        totalBidInvestment: '0',
      } as unknown as Bytecode;

      const contractBytecodeStates = new Map<string, ContractBytecodeState>([
        [
          '0x123456789abcdef',
          {
            bid: '1000000000000000000',
            bidPlusDecay: '1100000000000000000',
            totalBidInvestment: '2000000000000000000',
            isCached: true,
            size: 1024,
          },
        ],
      ]);

      mockBytecodeRepository.findOne.mockResolvedValue(mockBytecode);
      mockBytecodeRepository.save.mockResolvedValue(mockBytecode);

      // Act
      await service.updateContractBytecodes(
        mockBlockchain,
        contractBytecodeStates,
      );

      // Assert
      expect(mockBytecodeRepository.findOne.mock.calls[0][0]).toEqual({
        where: {
          blockchain: { id: 'blockchain-id' },
          bytecodeHash: '0x123456789abcdef',
        },
      });
      expect(mockBytecodeRepository.save.mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip processing when bytecode not found', async () => {
      // Arrange
      const mockBlockchain = {
        id: 'blockchain-id',
        name: 'Test Blockchain',
      } as Blockchain;

      const contractBytecodeStates = new Map<string, ContractBytecodeState>([
        [
          '0x123456789abcdef',
          {
            bid: '1000000000000000000',
            bidPlusDecay: '1100000000000000000',
            totalBidInvestment: '2000000000000000000',
            isCached: true,
            size: 1024,
          },
        ],
      ]);

      mockBytecodeRepository.findOne.mockResolvedValue(null);

      // Act
      await service.updateContractBytecodes(
        mockBlockchain,
        contractBytecodeStates,
      );

      // Assert
      expect(mockBytecodeRepository.findOne.mock.calls.length).toBe(1);
      expect(mockBytecodeRepository.save.mock.calls.length).toBe(0);
    });

    it('should process multiple bytecodes', async () => {
      // Arrange
      const mockBlockchain = {
        id: 'blockchain-id',
        name: 'Test Blockchain',
      } as Blockchain;

      const mockBytecode1 = {
        id: 'bytecode-id-1',
        bytecodeHash: '0x111',
        isCached: false,
      } as unknown as Bytecode;

      const mockBytecode2 = {
        id: 'bytecode-id-2',
        bytecodeHash: '0x222',
        isCached: true,
      } as unknown as Bytecode;

      const contractBytecodeStates = new Map<string, ContractBytecodeState>([
        [
          '0x111',
          {
            bid: '1000000000000000000',
            bidPlusDecay: '1100000000000000000',
            totalBidInvestment: '1000000000000000000',
            isCached: true,
            size: 1024,
          },
        ],
        [
          '0x222',
          {
            bid: '2000000000000000000',
            bidPlusDecay: '2200000000000000000',
            totalBidInvestment: '3000000000000000000',
            isCached: false,
            size: 2048,
          },
        ],
      ]);

      mockBytecodeRepository.findOne
        .mockResolvedValueOnce(mockBytecode1)
        .mockResolvedValueOnce(mockBytecode2);
      mockBytecodeRepository.save
        .mockResolvedValueOnce(mockBytecode1)
        .mockResolvedValueOnce(mockBytecode2);

      // Act
      await service.updateContractBytecodes(
        mockBlockchain,
        contractBytecodeStates,
      );

      // Assert
      expect(mockBytecodeRepository.findOne.mock.calls.length).toBe(2);
      expect(mockBytecodeRepository.save.mock.calls.length).toBe(2);
    });
  });
});
