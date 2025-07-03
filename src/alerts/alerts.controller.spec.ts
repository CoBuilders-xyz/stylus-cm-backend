import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { Alert } from './entities/alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { AlertType } from './constants';
import { AuthenticatedRequest } from 'src/common/types/custom-types';

describe('AlertsController', () => {
  let controller: AlertsController;
  let mockAlertsService: {
    getAlerts: jest.Mock;
    createOrUpdateAlert: jest.Mock;
  };

  const createMockRequest = (): AuthenticatedRequest =>
    ({
      user: {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      },
    }) as unknown as AuthenticatedRequest;

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.BID_SAFETY,
      value: '10',
      isActive: true,
      triggeredCount: 0,
      emailChannelEnabled: true,
      slackChannelEnabled: false,
      telegramChannelEnabled: false,
      webhookChannelEnabled: false,
    }) as unknown as Alert;

  beforeEach(async () => {
    mockAlertsService = {
      getAlerts: jest.fn(),
      createOrUpdateAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all alerts for user and blockchain', async () => {
      // Arrange
      const req = createMockRequest();
      const blockchainId = 'blockchain-123';
      const mockAlerts = [createMockAlert()];

      mockAlertsService.getAlerts.mockResolvedValue(mockAlerts);

      // Act
      const result = await controller.findAll(req, blockchainId);

      // Assert
      expect(mockAlertsService.getAlerts).toHaveBeenCalledWith(
        req.user,
        blockchainId,
      );
      expect(result).toEqual(mockAlerts);
    });

    it('should handle empty results', async () => {
      // Arrange
      const req = createMockRequest();
      const blockchainId = 'blockchain-123';

      mockAlertsService.getAlerts.mockResolvedValue([]);

      // Act
      const result = await controller.findAll(req, blockchainId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      // Arrange
      const req = createMockRequest();
      const blockchainId = 'blockchain-123';

      mockAlertsService.getAlerts.mockRejectedValue(new Error('Service error'));

      // Act & Assert
      await expect(controller.findAll(req, blockchainId)).rejects.toThrow(
        'Service error',
      );
      expect(mockAlertsService.getAlerts).toHaveBeenCalledWith(
        req.user,
        blockchainId,
      );
    });
  });

  describe('createOrUpdateAlert', () => {
    it('should create or update alert successfully', async () => {
      // Arrange
      const req = createMockRequest();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.BID_SAFETY,
        value: '15',
        isActive: true,
        userContractId: 'contract-123',
        emailChannelEnabled: true,
        slackChannelEnabled: false,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };
      const mockAlert = createMockAlert();

      mockAlertsService.createOrUpdateAlert.mockResolvedValue(mockAlert);

      // Act
      const result = await controller.createOrUpdateAlert(req, createAlertDto);

      // Assert
      expect(mockAlertsService.createOrUpdateAlert).toHaveBeenCalledWith(
        req.user,
        createAlertDto,
      );
      expect(result).toEqual(mockAlert);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const req = createMockRequest();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.BID_SAFETY,
        value: '15',
        isActive: true,
        userContractId: 'contract-123',
        emailChannelEnabled: true,
        slackChannelEnabled: false,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };

      mockAlertsService.createOrUpdateAlert.mockRejectedValue(
        new Error('Validation failed'),
      );

      // Act & Assert
      await expect(
        controller.createOrUpdateAlert(req, createAlertDto),
      ).rejects.toThrow('Validation failed');
      expect(mockAlertsService.createOrUpdateAlert).toHaveBeenCalledWith(
        req.user,
        createAlertDto,
      );
    });

    it('should handle service errors during creation', async () => {
      // Arrange
      const req = createMockRequest();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.EVICTION,
        value: '0',
        isActive: true,
        userContractId: 'contract-456',
        emailChannelEnabled: false,
        slackChannelEnabled: true,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };

      mockAlertsService.createOrUpdateAlert.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        controller.createOrUpdateAlert(req, createAlertDto),
      ).rejects.toThrow('Database error');
    });
  });
});
