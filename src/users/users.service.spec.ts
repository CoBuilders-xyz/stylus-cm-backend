import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { AlertsSettings } from './interfaces/alerts-settings.interface';

// Mock the logger utility
jest.mock('../common/utils/logger.util', () => ({
  createModuleLogger: jest.fn().mockReturnValue({
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Type definitions for mocks
interface MockRepository {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

describe('UsersService', () => {
  let service: UsersService;
  let mockRepository: MockRepository;

  const mockUser: User = {
    id: 'test-user-id',
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test User',
    isActive: true,
    alertsSettings: {
      emailSettings: {
        enabled: true,
        destination: 'test@example.com',
      },
    },
  };

  const mockAlertsSettings: AlertsSettings = {
    emailSettings: {
      enabled: true,
      destination: 'updated@example.com',
    },
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(testAddress);

      expect(result).toBe(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { address: testAddress },
      });
    });

    it('should return null when user not found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(testAddress);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return new user', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      const newUserData = {
        address: testAddress,
        alertsSettings: {},
      };

      mockRepository.create.mockReturnValue(newUserData);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(testAddress);

      expect(result).toBe(mockUser);
      expect(mockRepository.create).toHaveBeenCalledWith(newUserData);
      expect(mockRepository.save).toHaveBeenCalledWith(newUserData);
    });
  });

  describe('findOrCreate', () => {
    it('should return existing user when found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOrCreate(testAddress);

      expect(result).toBe(mockUser);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create new user when not found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        address: testAddress,
        alertsSettings: {},
      });
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.findOrCreate(testAddress);

      expect(result).toBe(mockUser);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('updateAlertsSettings', () => {
    it('should update and return user with new alerts settings', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      const updatedUser = { ...mockUser, alertsSettings: mockAlertsSettings };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateAlertsSettings(
        testAddress,
        mockAlertsSettings,
      );

      expect(result).toBe(updatedUser);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null when user not found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateAlertsSettings(
        testAddress,
        mockAlertsSettings,
      );

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateAlertChannel', () => {
    it('should update specific channel and return user', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      const channel = 'emailSettings';
      const newSettings = {
        enabled: true,
        destination: 'newemail@example.com',
      };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateAlertChannel(
        testAddress,
        channel,
        newSettings,
      );

      expect(result).toBe(mockUser);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should return null when user not found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      const channel = 'emailSettings';
      const newSettings = {
        enabled: true,
        destination: 'newemail@example.com',
      };

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.updateAlertChannel(
        testAddress,
        channel,
        newSettings,
      );

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAlertsSettings', () => {
    it('should return user alerts settings', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getAlertsSettings(testAddress);

      expect(result).toBe(mockUser.alertsSettings);
    });

    it('should return null when user not found', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getAlertsSettings(testAddress);

      expect(result).toBeNull();
    });
  });
});
