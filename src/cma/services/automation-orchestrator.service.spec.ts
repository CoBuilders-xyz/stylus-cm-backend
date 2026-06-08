import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationOrchestratorService } from './automation-orchestrator.service';
import { ContractSelectionService } from './contract-selection.service';
import { ActivationSelectionService } from './activation-selection.service';
import { BatchProcessorService } from './batch-processor.service';
import { Blockchain } from 'src/blockchains/entities/blockchain.entity';
import { SelectedContract, BatchProcessingResult } from '../interfaces';

describe('AutomationOrchestratorService', () => {
  let service: AutomationOrchestratorService;
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockBlockchainRepository: {
    find: jest.Mock;
  };
  let mockContractSelectionService: {
    selectOptimalBids: jest.Mock;
  };
  let mockActivationSelectionService: {
    selectOptimalActivations: jest.Mock;
  };
  let mockBatchProcessorService: {
    processContractBatches: jest.Mock;
    processActivationBatches: jest.Mock;
  };

  const createMockBlockchain = (): Blockchain =>
    ({
      id: 'blockchain-123',
      name: 'Test Blockchain',
      chainId: 421614,
      enabled: true,
    }) as Blockchain;

  const createMockBatchResult = (): BatchProcessingResult => ({
    totalBatches: 1,
    successfulBatches: 1,
    failedBatches: 0,
    totalContracts: 2,
    processedContracts: 2,
    results: [],
    startTime: new Date(),
    endTime: new Date(),
    totalDuration: 1000,
    errors: [],
  });

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockBlockchainRepository = {
      find: jest.fn(),
    };

    mockContractSelectionService = {
      selectOptimalBids: jest.fn(),
    };

    mockActivationSelectionService = {
      selectOptimalActivations: jest.fn(),
    };

    mockBatchProcessorService = {
      processContractBatches: jest.fn(),
      processActivationBatches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationOrchestratorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Blockchain),
          useValue: mockBlockchainRepository,
        },
        {
          provide: ContractSelectionService,
          useValue: mockContractSelectionService,
        },
        {
          provide: ActivationSelectionService,
          useValue: mockActivationSelectionService,
        },
        {
          provide: BatchProcessorService,
          useValue: mockBatchProcessorService,
        },
      ],
    }).compile();

    service = module.get<AutomationOrchestratorService>(
      AutomationOrchestratorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeCachingAutomation', () => {
    it('should return success when caching automation is disabled', async () => {
      mockConfigService.get.mockReturnValue({ cachingAutomationEnabled: false });

      const result = await service.executeCachingAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(0);
      expect(mockBlockchainRepository.find).not.toHaveBeenCalled();
    });

    it('should return success when no enabled blockchains found', async () => {
      mockConfigService.get.mockReturnValue({ cachingAutomationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([]);

      const result = await service.executeCachingAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(0);
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
    });

    it('should process caching automation for enabled blockchains', async () => {
      const blockchain = createMockBlockchain();
      const selectedContracts: SelectedContract[] = [
        { user: '0x123', address: '0xABC' },
      ];
      const batchResult = createMockBatchResult();

      mockConfigService.get.mockReturnValue({ cachingAutomationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockResolvedValue(
        selectedContracts,
      );
      mockBatchProcessorService.processContractBatches.mockResolvedValue(
        batchResult,
      );

      const result = await service.executeCachingAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(1);
      expect(result.stats.processedBlockchains).toBe(1);
      expect(result.stats.totalContracts).toBe(2);
      expect(result.stats.processedContracts).toBe(2);
      expect(
        mockContractSelectionService.selectOptimalBids,
      ).toHaveBeenCalledWith(blockchain);
      expect(
        mockBatchProcessorService.processContractBatches,
      ).toHaveBeenCalledWith(blockchain, selectedContracts);
    });

    it('should handle blockchain processing errors', async () => {
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ cachingAutomationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockRejectedValue(
        new Error('Selection error'),
      );

      const result = await service.executeCachingAutomation();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].blockchain).toBe(blockchain.name);
      expect(result.errors[0].error).toContain('Selection error');
    });

    it('should skip blockchain when no contracts selected', async () => {
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ cachingAutomationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockResolvedValue([]);

      const result = await service.executeCachingAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.processedBlockchains).toBe(1);
      expect(result.stats.totalContracts).toBe(0);
      expect(
        mockBatchProcessorService.processContractBatches,
      ).not.toHaveBeenCalled();
    });
  });

  describe('executeActivationAutomation', () => {
    it('should return success when activation automation is disabled', async () => {
      mockConfigService.get.mockReturnValue({
        activationAutomationEnabled: false,
      });

      const result = await service.executeActivationAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(0);
      expect(mockBlockchainRepository.find).not.toHaveBeenCalled();
    });

    it('should process activation automation for enabled blockchains', async () => {
      const blockchain = createMockBlockchain();
      const selectedContracts: SelectedContract[] = [
        { user: '0x123', address: '0xABC' },
      ];
      const batchResult = createMockBatchResult();

      mockConfigService.get.mockReturnValue({
        activationAutomationEnabled: true,
      });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockActivationSelectionService.selectOptimalActivations.mockResolvedValue({
        selectedContracts,
        maxActivationsPerIteration: 5,
      });
      mockBatchProcessorService.processActivationBatches.mockResolvedValue(
        batchResult,
      );

      const result = await service.executeActivationAutomation();

      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(1);
      expect(result.stats.processedContracts).toBe(2);
      expect(
        mockActivationSelectionService.selectOptimalActivations,
      ).toHaveBeenCalledWith(blockchain);
      expect(
        mockBatchProcessorService.processActivationBatches,
      ).toHaveBeenCalledWith(blockchain, selectedContracts, 5);
    });
  });
});
