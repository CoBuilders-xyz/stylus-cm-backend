import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { ethers } from 'ethers';

// 🚀 TESTING CONFIGURATION
const ENABLE_TEST_LOGS = true; // ← SET TO false TO DISABLE LOGS

// 📝 Clean test logging utility
const logTestResult = (
  testTitle: string,
  values: Record<string, unknown>,
  result?: any,
) => {
  if (ENABLE_TEST_LOGS) {
    process.stdout.write('\n' + '='.repeat(60) + '\n');
    process.stdout.write(`📋 ${testTitle}\n`);
    process.stdout.write('='.repeat(60) + '\n');

    if (values) {
      process.stdout.write('🔧 VALUES:\n');
      Object.entries(values).forEach(([key, value]) => {
        const displayValue =
          typeof value === 'string' ? value : JSON.stringify(value);
        process.stdout.write(`   ${key}: ${displayValue}\n`);
      });
    }

    if (result !== undefined) {
      process.stdout.write('✅ RESULT:\n');
      process.stdout.write(`   ${JSON.stringify(result, null, 2)}\n`);
    }

    process.stdout.write('='.repeat(60) + '\n\n');
  }
};

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

    logTestResult(
      'SERVICE INITIALIZATION TEST',
      {
        testType: 'Basic service setup validation',
        dependencies: [
          'CacheManager',
          'UsersService',
          'JwtService',
          'ConfigService',
        ],
      },
      { serviceExists: service !== undefined, testPassed: true },
    );
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

      logTestResult(
        'GENERATE NONCE - FORMAT & CACHE VALIDATION',
        {
          testAddress: testAddress,
          mockConfig: mockAuthConfig,
          generatedNonce: result.substring(0, 80) + '...',
          configCalls: mockConfigService.get.mock.calls.length,
          cacheCalls: mockCacheManager.set.mock.calls.length,
        },
        { testPassed: true, nonceGenerated: true },
      );
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

      logTestResult(
        'GENERATE NONCE - UNIQUENESS TEST',
        {
          testAddress: testAddress,
          nonce1Preview: nonce1.substring(0, 50) + '...',
          nonce2Preview: nonce2.substring(0, 50) + '...',
          cacheSetCalls: mockCacheManager.set.mock.calls.length,
        },
        { testPassed: true, areUnique: nonce1 !== nonce2 },
      );
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

      logTestResult(
        'GET NONCE - SUCCESS CASE',
        {
          testAddress: testAddress,
          mockCacheValue: testNonce,
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
        },
        { testPassed: true, returnedValue: result },
      );
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

      logTestResult(
        'GET NONCE - NOT FOUND CASE',
        {
          testAddress: testAddress,
          mockCacheValue: undefined,
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
        },
        { testPassed: true, returnedValue: result },
      );
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

      logTestResult(
        'GET NONCE - INVALID TYPE CASE',
        {
          testAddress: testAddress,
          mockCacheValue: 12345,
          mockCacheType: 'number',
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
        },
        { testPassed: true, returnedValue: result },
      );
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

      logTestResult(
        'GET NONCE - EMPTY STRING CASE',
        {
          testAddress: testAddress,
          mockCacheValue: '(empty string)',
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
        },
        { testPassed: true, returnedValue: result },
      );
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

      logTestResult(
        'GET NONCE - NULL VALUE CASE',
        {
          testAddress: testAddress,
          mockCacheValue: null,
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
        },
        { testPassed: true, returnedValue: result },
      );
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

      logTestResult(
        'VERIFY SIGNATURE - SUCCESS CASE',
        {
          inputAddress: testAddress,
          inputSignature: testSignature,
          mockNonce: testNonce.substring(0, 40) + '...',
          mockUser: testUser,
          mockJwt: testJwt,
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
          ethersVerifyCalls: (ethers.verifyMessage as jest.Mock).mock.calls
            .length,
          cacheDelCalls: mockCacheManager.del.mock.calls.length,
          userServiceCalls: mockUsersService.findOrCreate.mock.calls.length,
          jwtSignCalls: mockJwtService.signAsync.mock.calls.length,
        },
        { testPassed: true, returnedToken: result },
      );
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

      logTestResult(
        'VERIFY SIGNATURE - NONCE NOT FOUND',
        {
          inputAddress: testAddress,
          inputSignature: testSignature,
          mockCacheValue: null,
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
          ethersNotCalled:
            (ethers.verifyMessage as jest.Mock).mock.calls.length === 0,
          cacheDelNotCalled: mockCacheManager.del.mock.calls.length === 0,
        },
        { testPassed: true, errorThrown: errorMessage },
      );
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

      logTestResult(
        'VERIFY SIGNATURE - INVALID SIGNATURE',
        {
          inputAddress: testAddress,
          inputSignature: testSignature,
          mockNonce: testNonce.substring(0, 40) + '...',
          mockEthersError: 'Invalid signature',
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
          ethersVerifyCalls: (ethers.verifyMessage as jest.Mock).mock.calls
            .length,
          cacheDelNotCalled: mockCacheManager.del.mock.calls.length === 0,
          userServiceNotCalled:
            mockUsersService.findOrCreate.mock.calls.length === 0,
        },
        { testPassed: true, errorPropagated: true },
      );
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

      logTestResult(
        'VERIFY SIGNATURE - ADDRESS MISMATCH',
        {
          inputAddress: testAddress,
          recoveredAddress: differentAddress,
          inputSignature: testSignature,
          mockNonce: testNonce.substring(0, 40) + '...',
          cacheGetCalls: mockCacheManager.get.mock.calls.length,
          ethersVerifyCalls: (ethers.verifyMessage as jest.Mock).mock.calls
            .length,
          cacheDelNotCalled: mockCacheManager.del.mock.calls.length === 0,
        },
        { testPassed: true, errorThrown: errorMessage },
      );
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

      logTestResult(
        'VERIFY SIGNATURE - NONCE CLEANUP SECURITY TEST',
        {
          inputAddress: testAddress,
          inputSignature: testSignature,
          mockNonce: testNonce.substring(0, 40) + '...',
          mockEthersError: 'Invalid signature format',
          cacheDelCalls: mockCacheManager.del.mock.calls.length,
          noncePreserved: mockCacheManager.del.mock.calls.length === 0,
        },
        { testPassed: true, securityTestPassed: true, errorPropagated: true },
      );
    });
  });
});
