import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { TelegramNotificationService } from './telegram.service';
import { AlertType } from 'src/alerts/entities/alert.entity';

describe('TelegramNotificationService', () => {
  let service: TelegramNotificationService;
  let mockHttpService: {
    post: jest.Mock;
    axiosRef: {
      defaults: {
        httpAgent: any;
        httpsAgent: any;
        timeout: number;
      };
    };
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  const mockNotificationData = {
    destination: '12345678',
    alertType: AlertType.LOW_GAS,
    value: '10',
    contractName: 'Test Contract',
    contractAddress: '0x1234567890123456789012345678901234567890',
  };

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
      axiosRef: {
        defaults: {
          httpAgent: {},
          httpsAgent: {},
          timeout: 30000,
        },
      },
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-bot-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramNotificationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TelegramNotificationService>(
      TelegramNotificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send telegram notification successfully', async () => {
      // Arrange
      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(mockNotificationData);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.any(Object),
      );
    });

    it('should throw error when bot token is not configured', async () => {
      // Arrange - Create new service instance with undefined token
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TelegramNotificationService,
          {
            provide: HttpService,
            useValue: mockHttpService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const serviceWithoutToken = module.get<TelegramNotificationService>(
        TelegramNotificationService,
      );

      // Act & Assert
      await expect(
        serviceWithoutToken.sendNotification(mockNotificationData),
      ).rejects.toThrow('Telegram Bot Token is not configured');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should handle Telegram API errors', async () => {
      // Arrange
      const axiosError = {
        message: 'Request failed',
      } as AxiosError;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      // Act & Assert
      await expect(
        service.sendNotification(mockNotificationData),
      ).rejects.toThrow('Failed to send Telegram notification: Request failed');
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle different alert types', async () => {
      // Arrange
      const evictionAlert = {
        ...mockNotificationData,
        alertType: AlertType.EVICTION,
      };

      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(evictionAlert);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle BID_SAFETY alert type', async () => {
      // Arrange
      const bidSafetyAlert = {
        ...mockNotificationData,
        alertType: AlertType.BID_SAFETY,
        value: 'Safety threshold exceeded',
      };

      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(bidSafetyAlert);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle NO_GAS alert type', async () => {
      // Arrange
      const noGasAlert = {
        ...mockNotificationData,
        alertType: AlertType.NO_GAS,
      };

      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(noGasAlert);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalled();
    });
  });
});
