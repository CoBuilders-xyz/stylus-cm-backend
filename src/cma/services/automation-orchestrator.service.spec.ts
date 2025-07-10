import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationOrchestratorService } from './automation-orchestrator.service';
import { ContractSelectionService } from './contract-selection.service';
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
  let mockBatchProcessorService: {
    processContractBatches: jest.Mock;
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

    mockBatchProcessorService = {
      processContractBatches: jest.fn(),
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

  describe('executeAutomation', () => {
    it('should return success when automation is disabled', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue({ automationEnabled: false });

      // Act
      const result = await service.executeAutomation();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(0);
      expect(mockBlockchainRepository.find).not.toHaveBeenCalled();
    });

    it('should return success when no enabled blockchains found', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.executeAutomation();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.totalBlockchains).toBe(0);
      expect(mockBlockchainRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
      });
    });

    it('should process automation for enabled blockchains', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      const selectedContracts: SelectedContract[] = [
        { user: '0x123', address: '0xABC' },
      ];
      const batchResult = createMockBatchResult();

      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockResolvedValue(
        selectedContracts,
      );
      mockBatchProcessorService.processContractBatches.mockResolvedValue(
        batchResult,
      );

      // Act
      const result = await service.executeAutomation();

      // Assert
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
      // Arrange
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockRejectedValue(
        new Error('Selection error'),
      );

      // Act
      const result = await service.executeAutomation();

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].blockchain).toBe(blockchain.name);
      expect(result.errors[0].error).toContain('Selection error');
    });

    it('should skip blockchain when no contracts selected', async () => {
      // Arrange
      const blockchain = createMockBlockchain();
      mockConfigService.get.mockReturnValue({ automationEnabled: true });
      mockBlockchainRepository.find.mockResolvedValue([blockchain]);
      mockContractSelectionService.selectOptimalBids.mockResolvedValue([]);

      // Act
      const result = await service.executeAutomation();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats.processedBlockchains).toBe(1);
      expect(result.stats.totalContracts).toBe(0);
      expect(
        mockBatchProcessorService.processContractBatches,
      ).not.toHaveBeenCalled();
    });
  });
});
