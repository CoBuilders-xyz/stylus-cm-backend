import { Test, TestingModule } from '@nestjs/testing';
import { UserContractValidationService } from './user-contract-validation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserContract } from '../entities/user-contract.entity';
import { Blockchain } from '../../blockchains/entities/blockchain.entity';
import { User } from '../../users/entities/user.entity';
import { ethers } from 'ethers';

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    getAddress: jest.fn((address: string) => address.toLowerCase()),
    JsonRpcProvider: jest.fn(),
  },
}));

describe('UserContractValidationService', () => {
  let service: UserContractValidationService;
  let mockUserContractRepository: {
    findOne: jest.Mock;
  };
  let mockBlockchainRepository: {
    findOne: jest.Mock;
  };
  let mockProvider: {
    getCode: jest.Mock;
  };

  const createMockUser = (): User =>
    ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }) as unknown as User;

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      rpcUrl: 'https://test-rpc.com',
    }) as unknown as Blockchain;

  beforeEach(async () => {
    mockUserContractRepository = {
      findOne: jest.fn(),
    };

    mockBlockchainRepository = {
      findOne: jest.fn(),
    };

    mockProvider = {
      getCode: jest.fn(),
    };

    // Setup ethers mock
    (ethers.JsonRpcProvider as jest.Mock).mockImplementation(
      () => mockProvider,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContractValidationService,
        {
          provide: getRepositoryToken(UserContract),
          useValue: mockUserContractRepository,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
      ],
    }).compile();

    service = module.get<UserContractValidationService>(
      UserContractValidationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUserContractCreation', () => {
    it('should validate user contract creation successfully', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'blockchain-123';
      const blockchain = createMockBlockchain();

      mockUserContractRepository.findOne.mockResolvedValue(null); // No existing contract
      mockBlockchainRepository.findOne.mockResolvedValue(blockchain);

      // Act
      const result = await service.validateUserContractCreation(
        user,
        address,
        blockchainId,
      );

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: {
          address,
          blockchain: { id: blockchainId },
          user: { id: user.id },
        },
      });
      expect(mockBlockchainRepository.findOne).toHaveBeenCalledWith({
        where: { id: blockchainId },
      });
      expect(result).toEqual({
        blockchain,
        verifiedAddress: address.toLowerCase(),
      });
    });

    it('should throw error if user contract already exists', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'blockchain-123';
      const existingContract = {};

      mockUserContractRepository.findOne.mockResolvedValue(existingContract);

      // Act & Assert
      await expect(
        service.validateUserContractCreation(user, address, blockchainId),
      ).rejects.toThrow();
    });

    it('should throw error if blockchain not found', async () => {
      // Arrange
      const user = createMockUser();
      const address = '0x1234567890123456789012345678901234567890';
      const blockchainId = 'blockchain-123';

      mockUserContractRepository.findOne.mockResolvedValue(null);
      mockBlockchainRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.validateUserContractCreation(user, address, blockchainId),
      ).rejects.toThrow();
    });
  });

  describe('validateContractOnBlockchain', () => {
    it('should validate contract on blockchain successfully', async () => {
      // Arrange
      const address = '0x1234567890123456789012345678901234567890';
      const blockchain = createMockBlockchain();
      const mockBytecode = '0x608060405234801561001057600080fd5b50';

      mockProvider.getCode.mockResolvedValue(mockBytecode);

      // Act
      const result = await service.validateContractOnBlockchain(
        address,
        blockchain,
      );

      // Assert
      expect(mockProvider.getCode).toHaveBeenCalledWith(address);
      expect(result).toEqual({
        verifiedAddress: address.toLowerCase(),
        onChainBytecode: mockBytecode,
      });
    });

    it('should throw error if contract has empty bytecode', async () => {
      // Arrange
      const address = '0x1234567890123456789012345678901234567890';
      const blockchain = createMockBlockchain();
      const emptyBytecode = '0x';

      mockProvider.getCode.mockResolvedValue(emptyBytecode);

      // Act & Assert
      await expect(
        service.validateContractOnBlockchain(address, blockchain),
      ).rejects.toThrow();
    });

    it('should handle provider errors', async () => {
      // Arrange
      const address = '0x1234567890123456789012345678901234567890';
      const blockchain = createMockBlockchain();

      mockProvider.getCode.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.validateContractOnBlockchain(address, blockchain),
      ).rejects.toThrow();
    });
  });
});
