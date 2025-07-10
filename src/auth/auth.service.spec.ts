import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { ethers } from 'ethers';

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    verifyMessage: jest.fn(),
  },
}));

// Type definitions for mocks
interface MockCacheManager {
  del: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
}

interface MockUsersService {
  findOrCreate: jest.Mock;
}

interface MockJwtService {
  signAsync: jest.Mock;
}

interface MockConfigService {
  get: jest.Mock;
}

describe('AuthService', () => {
  let service: AuthService;
  let mockCacheManager: MockCacheManager;
  let mockConfigService: MockConfigService;
  let mockUsersService: MockUsersService;
  let mockJwtService: MockJwtService;

  beforeEach(async () => {
    // Create mocks for all dependencies
    mockCacheManager = {
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    mockUsersService = {
      findOrCreate: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNonce', () => {
    it('should generate nonce with correct format and save to cache', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const mockAuthConfig = {
        nonceExpiration: 300000, // 5 minutes
        jwtSecret: 'test-secret',
        jwtExpiresIn: '1d',
      };

      mockConfigService.get.mockReturnValue(mockAuthConfig);

      // Act
      const result = await service.generateNonce(testAddress);

      // Assert
      expect(typeof result).toBe('string');
      expect(result).toContain(testAddress);
      expect(result).toContain('Hello, welcome to Stylus Cache Manager UI');
      expect(result).toContain(
        'Please sign this message to verify your wallet',
      );
      expect(result).toContain('This action has no cost');
      expect(result).toContain('Address:');
      expect(result).toContain('Nonce:');
      expect(mockConfigService.get).toHaveBeenCalledWith('auth');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        testAddress,
        result,
        mockAuthConfig.nonceExpiration,
      );
      expect(mockCacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should generate unique nonces for multiple calls', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const mockAuthConfig = {
        nonceExpiration: 300000,
        jwtSecret: 'test-secret',
        jwtExpiresIn: '1d',
      };

      mockConfigService.get.mockReturnValue(mockAuthConfig);

      // Act
      const nonce1 = await service.generateNonce(testAddress);
      const nonce2 = await service.generateNonce(testAddress);

      // Assert
      expect(nonce1).not.toBe(nonce2);
      expect(mockCacheManager.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('getNonce', () => {
    it('should return nonce when it exists in cache', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testNonce = 'Hello, welcome to Stylus Cache Manager UI...';

      mockCacheManager.get.mockResolvedValue(testNonce);

      // Act
      const result = await service.getNonce(testAddress);

      // Assert
      expect(result).toBe(testNonce);
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should return null when nonce does not exist in cache', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';

      mockCacheManager.get.mockResolvedValue(undefined);

      // Act
      const result = await service.getNonce(testAddress);

      // Assert
      expect(result).toBeNull();
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
    });

    it('should return null when cached value is not a string', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';

      mockCacheManager.get.mockResolvedValue(12345); // number instead of string

      // Act
      const result = await service.getNonce(testAddress);

      // Assert
      expect(result).toBeNull();
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
    });

    it('should return null when cached value is an empty string', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';

      mockCacheManager.get.mockResolvedValue(''); // empty string

      // Act
      const result = await service.getNonce(testAddress);

      // Assert
      expect(result).toBeNull();
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
    });

    it('should return null when cached value is null', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';

      mockCacheManager.get.mockResolvedValue(null);

      // Act
      const result = await service.getNonce(testAddress);

      // Assert
      expect(result).toBeNull();
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
    });
  });

  describe('verifySignature', () => {
    it('should verify signature successfully and return JWT', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testSignature = '0x123456789abcdef...';
      const testNonce = 'Hello, welcome to Stylus Cache Manager UI...';
      const testUser = { id: 1, address: testAddress };
      const testJwt = 'jwt.token.here';

      // Mock nonce exists in cache
      mockCacheManager.get.mockResolvedValue(testNonce);
      // Mock ethers signature verification succeeds
      (ethers.verifyMessage as jest.Mock).mockReturnValue(testAddress);
      // Mock user service returns user
      mockUsersService.findOrCreate.mockResolvedValue(testUser);
      // Mock JWT service returns token
      mockJwtService.signAsync.mockResolvedValue(testJwt);

      // Act
      const result = await service.verifySignature(testAddress, testSignature);

      // Assert
      expect(result).toEqual({ accessToken: testJwt });
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        testNonce,
        testSignature,
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(testAddress);
      expect(mockUsersService.findOrCreate).toHaveBeenCalledWith(testAddress);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        userId: testUser.id,
        userAddress: testUser.address,
      });
    });

    it('should throw error when nonce does not exist', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testSignature = '0x123456789abcdef...';

      // Mock nonce doesn't exist in cache
      mockCacheManager.get.mockResolvedValue(null);

      // Act & Assert
      let errorMessage = '';
      try {
        await service.verifySignature(testAddress, testSignature);
      } catch (error: unknown) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      await expect(
        service.verifySignature(testAddress, testSignature),
      ).rejects.toThrow(
        'Nonce not found or expired. Please generate a new nonce',
      );

      // Should only check cache, no further operations
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
      expect(ethers.verifyMessage).not.toHaveBeenCalled();
      expect(mockCacheManager.del).not.toHaveBeenCalled();
      expect(mockUsersService.findOrCreate).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw error when signature verification fails', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testSignature = '0x123456789abcdef...';
      const testNonce = 'Hello, welcome to Stylus Cache Manager UI...';

      // Mock nonce exists in cache
      mockCacheManager.get.mockResolvedValue(testNonce);

      // Mock ethers throws error during verification
      (ethers.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      await expect(
        service.verifySignature(testAddress, testSignature),
      ).rejects.toThrow('Invalid signature');

      // Should try to verify but fail
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        testNonce,
        testSignature,
      );

      // Should not proceed after signature failure
      expect(mockCacheManager.del).not.toHaveBeenCalled();
      expect(mockUsersService.findOrCreate).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw error when recovered address does not match provided address', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const differentAddress = '0x9999999999999999999999999999999999999999';
      const testSignature = '0x123456789abcdef...';
      const testNonce = 'Hello, welcome to Stylus Cache Manager UI...';

      // Mock nonce exists in cache
      mockCacheManager.get.mockResolvedValue(testNonce);

      // Mock ethers returns different address (signature was valid but for wrong address)
      (ethers.verifyMessage as jest.Mock).mockReturnValue(differentAddress);

      // Act & Assert
      let errorMessage = '';
      try {
        await service.verifySignature(testAddress, testSignature);
      } catch (error: unknown) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      await expect(
        service.verifySignature(testAddress, testSignature),
      ).rejects.toThrow(
        'Signature verification failed. Please check your signature and try again',
      );

      // Should verify signature but detect mismatch
      expect(mockCacheManager.get).toHaveBeenCalledWith(testAddress);
      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        testNonce,
        testSignature,
      );

      // Should not proceed after address mismatch
      expect(mockCacheManager.del).not.toHaveBeenCalled();
      expect(mockUsersService.findOrCreate).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should clean up nonce only after successful verification', async () => {
      // Arrange
      const testAddress = '0x1234567890123456789012345678901234567890';
      const testSignature = '0x123456789abcdef...';
      const testNonce = 'Hello, welcome to Stylus Cache Manager UI...';

      // Mock nonce exists in cache
      mockCacheManager.get.mockResolvedValue(testNonce);

      // Mock signature verification throws error
      (ethers.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature format');
      });

      // Act & Assert
      await expect(
        service.verifySignature(testAddress, testSignature),
      ).rejects.toThrow('Invalid signature format');

      // Nonce should NOT be deleted if verification fails
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });
  });
});
