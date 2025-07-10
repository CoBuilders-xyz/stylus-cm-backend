import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { WebhookNotificationService } from './webhook.service';
import { AlertType } from 'src/alerts/entities/alert.entity';

describe('WebhookNotificationService', () => {
  let service: WebhookNotificationService;
  let mockHttpService: {
    post: jest.Mock;
  };

  const mockNotificationData = {
    destination: 'https://example.com/webhook',
    alertId: 'alert-123',
    alertType: AlertType.LOW_GAS,
    value: '10',
    contractName: 'Test Contract',
    contractAddress: '0x1234567890123456789012345678901234567890',
    triggeredCount: 1,
  };

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookNotificationService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<WebhookNotificationService>(
      WebhookNotificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send webhook notification successfully', async () => {
      // Arrange
      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(mockNotificationData);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        mockNotificationData.destination,
        expect.any(Object),
      );
    });

    it('should handle webhook API errors', async () => {
      // Arrange
      const axiosError = {
        message: 'Request failed',
      } as AxiosError;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      // Act & Assert
      await expect(
        service.sendNotification(mockNotificationData),
      ).rejects.toThrow('Failed to send webhook notification: Request failed');
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
      expect(mockHttpService.post).toHaveBeenCalledWith(
        evictionAlert.destination,
        expect.any(Object),
      );
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

    it('should use default triggered count when not provided', async () => {
      // Arrange
      const alertWithoutCount = {
        ...mockNotificationData,
        triggeredCount: undefined,
      };

      mockHttpService.post.mockReturnValue(of({ data: { success: true } }));

      // Act
      const result = await service.sendNotification(alertWithoutCount);

      // Assert
      expect(result).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalled();
    });
  });
});
