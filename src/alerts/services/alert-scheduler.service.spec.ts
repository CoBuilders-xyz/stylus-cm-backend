import { Test, TestingModule } from '@nestjs/testing';
import { AlertSchedulerService } from './alert-scheduler.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Alert } from '../entities/alert.entity';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { AlertConditionEvaluatorService } from './alert-condition-evaluator.service';
import { AlertType } from '../constants';

describe('AlertSchedulerService', () => {
  let service: AlertSchedulerService;
  let mockAlertRepository: {
    find: jest.Mock;
  };
  let mockBlockchainRepository: {
    find: jest.Mock;
  };
  let mockAlertConditionEvaluator: {
    evaluateBidSafetyCondition: jest.Mock;
  };
  let mockAlertsQueue: {
    add: jest.Mock;
  };

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      enabled: true,
    }) as unknown as Blockchain;

  const createMockAlert = (): Alert =>
    ({
      id: 'alert-123',
      type: AlertType.BID_SAFETY,
      isActive: true,
      userContract: {
        blockchain: { id: 'blockchain-123' },
        contract: { id: 'contract-123' },
      },
    }) as unknown as Alert;

  beforeEach(async () => {
    mockAlertRepository = {
      find: jest.fn(),
    };

    mockBlockchainRepository = {
      find: jest.fn(),
    };

    mockAlertConditionEvaluator = {
      evaluateBidSafetyCondition: jest.fn(),
    };

    mockAlertsQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertSchedulerService,
        {
          provide: getRepositoryToken(Alert),
          useValue: mockAlertRepository,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
        {
          provide: AlertConditionEvaluatorService,
          useValue: mockAlertConditionEvaluator,
        },
        {
          provide: getQueueToken('alerts'),
          useValue: mockAlertsQueue,
        },
      ],
    }).compile();

    service = module.get<AlertSchedulerService>(AlertSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleRealTimeMonitoring', () => {
    it('should process alerts for all enabled blockchains', async () => {
      // Arrange
      const mockBlockchains = [createMockBlockchain()];
      const mockAlerts = [createMockAlert()];

      mockBlockchainRepository.find.mockResolvedValue(mockBlockchains);
      mockAlertRepository.find.mockResolvedValue(mockAlerts);
      mockAlertConditionEvaluator.evaluateBidSafetyCondition.mockResolvedValue(
        false,
      ); // Alert should not trigger
      mockAlertsQueue.add.mockResolvedValue(undefined);

      // Act
      await service.scheduleRealTimeMonitoring();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
      expect(mockAlertRepository.find).toHaveBeenCalledWith({
        where: {
          type: AlertType.BID_SAFETY,
          isActive: true,
          userContract: {
            blockchain: { id: mockBlockchains[0].id },
          },
        },
        relations: [
          'userContract',
          'userContract.contract',
          'userContract.contract.blockchain',
          'userContract.contract.bytecode',
        ],
      });
      expect(
        mockAlertConditionEvaluator.evaluateBidSafetyCondition,
      ).toHaveBeenCalledWith(mockAlerts[0], mockBlockchains[0]);
      expect(mockAlertsQueue.add).not.toHaveBeenCalled(); // No alerts triggered
    });

    it('should queue alerts when conditions are met', async () => {
      // Arrange
      const mockBlockchains = [createMockBlockchain()];
      const mockAlerts = [createMockAlert()];

      mockBlockchainRepository.find.mockResolvedValue(mockBlockchains);
      mockAlertRepository.find.mockResolvedValue(mockAlerts);
      mockAlertConditionEvaluator.evaluateBidSafetyCondition.mockResolvedValue(
        true,
      ); // Alert should trigger
      mockAlertsQueue.add.mockResolvedValue(undefined);

      // Act
      await service.scheduleRealTimeMonitoring();

      // Assert
      expect(mockAlertsQueue.add).toHaveBeenCalledWith('alert-triggered', {
        alertId: mockAlerts[0].id,
      });
    });

    it('should handle no enabled blockchains gracefully', async () => {
      // Arrange
      mockBlockchainRepository.find.mockResolvedValue([]);

      // Act
      await service.scheduleRealTimeMonitoring();

      // Assert
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
      expect(mockAlertRepository.find).not.toHaveBeenCalled();
      expect(mockAlertsQueue.add).not.toHaveBeenCalled();
    });

    it('should handle no alerts for blockchain gracefully', async () => {
      // Arrange
      const mockBlockchains = [createMockBlockchain()];

      mockBlockchainRepository.find.mockResolvedValue(mockBlockchains);
      mockAlertRepository.find.mockResolvedValue([]); // No alerts

      // Act
      await service.scheduleRealTimeMonitoring();

      // Assert
      expect(mockAlertRepository.find).toHaveBeenCalled();
      expect(
        mockAlertConditionEvaluator.evaluateBidSafetyCondition,
      ).not.toHaveBeenCalled();
      expect(mockAlertsQueue.add).not.toHaveBeenCalled();
    });

    it('should continue processing other alerts if one fails', async () => {
      // Arrange
      const mockBlockchains = [createMockBlockchain()];
      const mockAlerts = [createMockAlert(), createMockAlert()];
      mockAlerts[1].id = 'alert-456';

      mockBlockchainRepository.find.mockResolvedValue(mockBlockchains);
      mockAlertRepository.find.mockResolvedValue(mockAlerts);
      mockAlertConditionEvaluator.evaluateBidSafetyCondition
        .mockRejectedValueOnce(new Error('Evaluation failed')) // First alert fails
        .mockResolvedValueOnce(true); // Second alert succeeds
      mockAlertsQueue.add.mockResolvedValue(undefined);

      // Act
      await service.scheduleRealTimeMonitoring();

      // Assert
      expect(
        mockAlertConditionEvaluator.evaluateBidSafetyCondition,
      ).toHaveBeenCalledTimes(2);
      expect(mockAlertsQueue.add).toHaveBeenCalledWith('alert-triggered', {
        alertId: 'alert-456',
      });
    });
  });
});
