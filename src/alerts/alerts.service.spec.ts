import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { AlertCrudService } from './services/alert-crud.service';
import { Alert } from './entities/alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { AlertType } from './constants';
import { User } from 'src/users/entities/user.entity';

describe('AlertsService', () => {
  let service: AlertsService;
  let mockCrudService: {
    getAlerts: jest.Mock;
    getAlertsForUserContract: jest.Mock;
    createOrUpdateAlert: jest.Mock;
  };

  const createMockUser = (): User =>
    ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }) as unknown as User;

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.BID_SAFETY,
      value: '10',
      isActive: true,
    }) as unknown as Alert;

  beforeEach(async () => {
    mockCrudService = {
      getAlerts: jest.fn(),
      getAlertsForUserContract: jest.fn(),
      createOrUpdateAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: AlertCrudService,
          useValue: mockCrudService,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlerts', () => {
    it('should delegate to crud service', async () => {
      // Arrange
      const user = createMockUser();
      const blockchainId = 'blockchain-123';
      const mockAlerts = [createMockAlert()];

      mockCrudService.getAlerts.mockResolvedValue(mockAlerts);

      // Act
      const result = await service.getAlerts(user, blockchainId);

      // Assert
      expect(mockCrudService.getAlerts).toHaveBeenCalledWith(
        user,
        blockchainId,
      );
      expect(result).toEqual(mockAlerts);
    });
  });

  describe('createOrUpdateAlert', () => {
    it('should delegate to crud service', async () => {
      // Arrange
      const user = createMockUser();
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

      mockCrudService.createOrUpdateAlert.mockResolvedValue(mockAlert);

      // Act
      const result = await service.createOrUpdateAlert(user, createAlertDto);

      // Assert
      expect(mockCrudService.createOrUpdateAlert).toHaveBeenCalledWith(
        user,
        createAlertDto,
      );
      expect(result).toEqual(mockAlert);
    });
  });
});
