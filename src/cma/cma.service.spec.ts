import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CmaService } from './cma.service';
import { AutomationOrchestratorService } from './services';
import { AutomationResult } from './interfaces';

describe('CmaService', () => {
  let service: CmaService;
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockOrchestratorService: {
    executeAutomation: jest.Mock;
  };

  const createMockAutomationResult = (): AutomationResult => ({
    success: true,
    stats: {
      totalBlockchains: 2,
      processedBlockchains: 2,
      totalContracts: 10,
      processedContracts: 8,
      successfulBatches: 2,
      failedBatches: 0,
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
    },
    errors: [],
  });

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockOrchestratorService = {
      executeAutomation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AutomationOrchestratorService,
          useValue: mockOrchestratorService,
        },
      ],
    }).compile();

    service = module.get<CmaService>(CmaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      // Act
      await service.onModuleInit();

      // Assert - no exceptions thrown
      expect(service).toBeDefined();
    });
  });

  describe('handleCmaAutomation', () => {
    it('should skip automation when disabled', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue({ automationEnabled: false });

      // Act
      await service.handleCmaAutomation();

      // Assert
      expect(mockOrchestratorService.executeAutomation).not.toHaveBeenCalled();
    });

    it('should execute automation when enabled', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      const mockResult = createMockAutomationResult();
      mockOrchestratorService.executeAutomation.mockResolvedValue(mockResult);

      // Act
      await service.handleCmaAutomation();

      // Assert
      expect(mockOrchestratorService.executeAutomation).toHaveBeenCalled();
    });

    it('should handle automation errors gracefully', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      mockOrchestratorService.executeAutomation.mockRejectedValue(
        new Error('Test error'),
      );

      // Act & Assert - should not throw
      await expect(service.handleCmaAutomation()).resolves.toBeUndefined();
    });
  });
});
