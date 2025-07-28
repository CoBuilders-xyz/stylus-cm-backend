import { Test, TestingModule } from '@nestjs/testing';
import { AlertCrudService } from './alert-crud.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Alert } from '../entities/alert.entity';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { User } from 'src/users/entities/user.entity';
import { CreateAlertDto } from '../dto/create-alert.dto';
import { AlertType } from '../constants';
describe('AlertCrudService', () => {
  let service: AlertCrudService;
  let mockAlertRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockUserContractRepository: {
    findOne: jest.Mock;
  };

  const createMockUser = (): User =>
    ({
      id: 'user-123',
      username: 'testuser',
    }) as unknown as User;

  const createMockUserContract = (): UserContract =>
    ({
      id: 'contract-123',
      address: '0x1234567890123456789012345678901234567890',
      blockchain: {
        id: 'blockchain-123',
        name: 'Test Blockchain',
      },
      contract: {
        id: 'contract-456',
        name: 'Test Contract',
      },
    }) as unknown as UserContract;

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.BID_SAFETY,
      value: '10',
      isActive: true,
      triggeredCount: 0,
      user: createMockUser(),
      userContract: createMockUserContract(),
      slackChannelEnabled: false,
      telegramChannelEnabled: false,
      webhookChannelEnabled: false,
    }) as Alert;

  const createMockQueryBuilder = () => ({
    createQueryBuilder: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  });

  beforeEach(async () => {
    mockAlertRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockUserContractRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertCrudService,
        {
          provide: getRepositoryToken(Alert),
          useValue: mockAlertRepository,
        },
        {
          provide: getRepositoryToken(UserContract),
          useValue: mockUserContractRepository,
        },
      ],
    }).compile();

    service = module.get<AlertCrudService>(AlertCrudService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlerts', () => {
    it('should return alerts for user and blockchain', async () => {
      // Arrange
      const user = createMockUser();
      const blockchainId = 'blockchain-123';
      const mockAlerts = [createMockAlert()];
      const mockQueryBuilder = createMockQueryBuilder();

      mockAlertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue(mockAlerts);

      // Act
      const result = await service.getAlerts(user, blockchainId);

      // Assert
      expect(mockAlertRepository.createQueryBuilder).toHaveBeenCalledWith(
        'alert',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'alert.userContract',
        'userContract',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'userContract.blockchain',
        'blockchain',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'alert.user = :userId',
        { userId: user.id },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'blockchain.id = :blockchainId',
        { blockchainId },
      );
      expect(result).toEqual(mockAlerts);
    });

    it('should handle empty results', async () => {
      // Arrange
      const user = createMockUser();
      const blockchainId = 'blockchain-123';
      const mockQueryBuilder = createMockQueryBuilder();

      mockAlertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await service.getAlerts(user, blockchainId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createOrUpdateAlert', () => {
    it('should create new alert when none exists', async () => {
      // Arrange
      const user = createMockUser();
      const userContract = createMockUserContract();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.BID_SAFETY,
        value: '15',
        isActive: true,
        userContractId: userContract.id,
        slackChannelEnabled: false,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };
      const mockAlert = createMockAlert();
      const savedAlert = { ...mockAlert, id: 'new-alert-123' };

      mockUserContractRepository.findOne.mockResolvedValue(userContract);
      mockAlertRepository.findOne.mockResolvedValue(null); // No existing alert
      mockAlertRepository.create.mockReturnValue(mockAlert);
      mockAlertRepository.save.mockResolvedValue(savedAlert);

      // Act
      const result = await service.createOrUpdateAlert(user, createAlertDto);

      // Assert
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: { id: createAlertDto.userContractId },
        relations: ['blockchain'],
      });
      expect(mockAlertRepository.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: user.id },
          userContract: { id: createAlertDto.userContractId },
          type: createAlertDto.type,
        },
      });
      expect(mockAlertRepository.create).toHaveBeenCalledWith(createAlertDto);
      expect(mockAlertRepository.save).toHaveBeenCalledWith(mockAlert);
      expect(result).toEqual(savedAlert);
    });

    it('should update existing alert when one exists', async () => {
      // Arrange
      const user = createMockUser();
      const userContract = createMockUserContract();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.BID_SAFETY,
        value: '20',
        isActive: false,
        userContractId: userContract.id,
        slackChannelEnabled: true,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };
      const existingAlert = createMockAlert();
      const updatedAlert = {
        ...existingAlert,
        value: createAlertDto.value,
        isActive: createAlertDto.isActive,
        slackChannelEnabled: true,
      };

      mockUserContractRepository.findOne.mockResolvedValue(userContract);
      mockAlertRepository.findOne.mockResolvedValue(existingAlert);
      mockAlertRepository.save.mockResolvedValue(updatedAlert);

      // Act
      const result = await service.createOrUpdateAlert(user, createAlertDto);

      // Assert
      expect(mockAlertRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: createAlertDto.value,
          isActive: createAlertDto.isActive,
          slackChannelEnabled: true,
        }),
      );
      expect(result).toEqual(updatedAlert);
    });

    it('should throw error when user contract not found', async () => {
      // Arrange
      const user = createMockUser();
      const createAlertDto: CreateAlertDto = {
        type: AlertType.BID_SAFETY,
        value: '10',
        isActive: true,
        userContractId: 'non-existent-contract',
        slackChannelEnabled: false,
        telegramChannelEnabled: false,
        webhookChannelEnabled: false,
      };

      mockUserContractRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createOrUpdateAlert(user, createAlertDto),
      ).rejects.toThrow();
      expect(mockUserContractRepository.findOne).toHaveBeenCalledWith({
        where: { id: createAlertDto.userContractId },
        relations: ['blockchain'],
      });
      expect(mockAlertRepository.create).not.toHaveBeenCalled();
      expect(mockAlertRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getAlertsForUserContract', () => {
    it('should return alerts for specific user contract', async () => {
      // Arrange
      const userId = 'user-123';
      const userContractId = 'contract-123';
      const mockAlerts = [createMockAlert()];
      const mockQueryBuilder = createMockQueryBuilder();

      mockAlertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue(mockAlerts);

      // Act
      const result = await service.getAlertsForUserContract(
        userId,
        userContractId,
      );

      // Assert
      expect(mockAlertRepository.createQueryBuilder).toHaveBeenCalledWith(
        'alert',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'alert.user = :userId',
        { userId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.userContract = :userContractId',
        { userContractId },
      );
      expect(result).toEqual(mockAlerts);
    });
  });
});
