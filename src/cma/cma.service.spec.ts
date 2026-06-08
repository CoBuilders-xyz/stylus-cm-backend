import { Test, TestingModule } from '@nestjs/testing';
import { CmaService } from './cma.service';
import { AutomationOrchestratorService } from './services';
import { AutomationResult } from './interfaces';

describe('CmaService', () => {
  let service: CmaService;
  let mockOrchestratorService: {
    executeCachingAutomation: jest.Mock;
    executeActivationAutomation: jest.Mock;
  };

  const createMockAutomationResult = (
    overrides?: Partial<AutomationResult>,
  ): AutomationResult => ({
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
    ...overrides,
  });

  beforeEach(async () => {
    mockOrchestratorService = {
      executeCachingAutomation: jest.fn(),
      executeActivationAutomation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmaService,
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
    it('should initialize successfully', () => {
      service.onModuleInit();
      expect(service).toBeDefined();
    });
  });

  describe('handleCmaAutomation', () => {
    it('should execute both caching and activation automation', async () => {
      const mockResult = createMockAutomationResult();
      mockOrchestratorService.executeCachingAutomation.mockResolvedValue(
        mockResult,
      );
      mockOrchestratorService.executeActivationAutomation.mockResolvedValue(
        mockResult,
      );

      await service.handleCmaAutomation();

      expect(
        mockOrchestratorService.executeCachingAutomation,
      ).toHaveBeenCalled();
      expect(
        mockOrchestratorService.executeActivationAutomation,
      ).toHaveBeenCalled();
    });

    it('should handle caching automation errors gracefully and still run activation', async () => {
      mockOrchestratorService.executeCachingAutomation.mockRejectedValue(
        new Error('Caching error'),
      );
      mockOrchestratorService.executeActivationAutomation.mockResolvedValue(
        createMockAutomationResult(),
      );

      await expect(service.handleCmaAutomation()).resolves.toBeUndefined();
      expect(
        mockOrchestratorService.executeActivationAutomation,
      ).toHaveBeenCalled();
    });

    it('should handle activation automation errors gracefully', async () => {
      mockOrchestratorService.executeCachingAutomation.mockResolvedValue(
        createMockAutomationResult(),
      );
      mockOrchestratorService.executeActivationAutomation.mockRejectedValue(
        new Error('Activation error'),
      );

      await expect(service.handleCmaAutomation()).resolves.toBeUndefined();
    });
  });
});
