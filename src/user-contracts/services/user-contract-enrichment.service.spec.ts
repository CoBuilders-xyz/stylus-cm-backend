import { Test, TestingModule } from '@nestjs/testing';
import { UserContractEnrichmentService } from './user-contract-enrichment.service';
import { ContractEnrichmentService } from '../../contracts/services/contract-enrichment.service';
import { AlertsService } from '../../alerts/alerts.service';
import { UserContract } from '../entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import { Contract } from '../../contracts/entities/contract.entity';

describe('UserContractEnrichmentService', () => {
  let service: UserContractEnrichmentService;
  let mockContractEnrichmentService: {
    processContract: jest.Mock;
  };
  let mockAlertsService: {
    getAlertsForUserContract: jest.Mock;
  };

  const createMockUser = (): User =>
    ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }) as unknown as User;

  const createMockContract = (): Contract =>
    ({
      id: 'contract-123',
      address: '0x1234567890123456789012345678901234567890',
    }) as unknown as Contract;

  const createMockUserContract = (): UserContract =>
    ({
      id: 'user-contract-123',
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test Contract',
      user: createMockUser(),
      contract: createMockContract(),
    }) as unknown as UserContract;

  beforeEach(async () => {
    mockContractEnrichmentService = {
      processContract: jest.fn(),
    };

    mockAlertsService = {
      getAlertsForUserContract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContractEnrichmentService,
        {
          provide: ContractEnrichmentService,
          useValue: mockContractEnrichmentService,
        },
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    service = module.get<UserContractEnrichmentService>(
      UserContractEnrichmentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichUserContract', () => {
    it('should enrich user contract with alerts and contract data', async () => {
      // Arrange
      const user = createMockUser();
      const userContract = createMockUserContract();
      const mockAlerts = [{ id: 'alert-1', type: 'BID_SAFETY' }];
      const processedContract = { ...userContract.contract, processed: true };

      mockAlertsService.getAlertsForUserContract.mockResolvedValue(mockAlerts);
      mockContractEnrichmentService.processContract.mockResolvedValue(
        processedContract,
      );

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await service.enrichUserContract(userContract, user, true);

      // Assert
      expect(mockAlertsService.getAlertsForUserContract).toHaveBeenCalledWith(
        user.id,
        userContract.id,
      );
      expect(
        mockContractEnrichmentService.processContract,
      ).toHaveBeenCalledWith(userContract.contract, true);
      expect(result).toEqual({
        ...userContract,
        contract: processedContract,
        alerts: mockAlerts,
      });
    });

    it('should enrich user contract without contract data when no contract', async () => {
      // Arrange
      const user = createMockUser();
      const userContract = {
        ...createMockUserContract(),
        contract: null,
      } as unknown as UserContract;
      const mockAlerts = [{ id: 'alert-1', type: 'BID_SAFETY' }];

      mockAlertsService.getAlertsForUserContract.mockResolvedValue(mockAlerts);

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await service.enrichUserContract(userContract, user);

      // Assert
      expect(mockAlertsService.getAlertsForUserContract).toHaveBeenCalledWith(
        user.id,
        userContract.id,
      );
      expect(
        mockContractEnrichmentService.processContract,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...userContract,
        alerts: mockAlerts,
      });
    });

    it('should handle enrichment errors', async () => {
      // Arrange
      const user = createMockUser();
      const userContract = createMockUserContract();
      const error = new Error('Enrichment failed');

      mockAlertsService.getAlertsForUserContract.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.enrichUserContract(userContract, user),
      ).rejects.toThrow();
    });
  });

  describe('enrichUserContracts', () => {
    it('should enrich multiple user contracts', async () => {
      // Arrange
      const user = createMockUser();
      const userContracts = [
        createMockUserContract(),
        createMockUserContract(),
      ];
      const mockAlerts = [{ id: 'alert-1' }];
      const processedContract = { processed: true };

      mockAlertsService.getAlertsForUserContract.mockResolvedValue(mockAlerts);
      mockContractEnrichmentService.processContract.mockResolvedValue(
        processedContract,
      );

      // Act
      const result = await service.enrichUserContracts(userContracts, user);

      // Assert
      expect(mockAlertsService.getAlertsForUserContract).toHaveBeenCalledTimes(
        2,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('alerts', mockAlerts);
      expect(result[1]).toHaveProperty('alerts', mockAlerts);
    });

    it('should handle errors in bulk enrichment', async () => {
      // Arrange
      const user = createMockUser();
      const userContracts = [createMockUserContract()];
      const error = new Error('Bulk enrichment failed');

      mockAlertsService.getAlertsForUserContract.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.enrichUserContracts(userContracts, user),
      ).rejects.toThrow();
    });
  });

  describe('createPaginationResponse', () => {
    it('should create pagination response correctly', () => {
      // Arrange
      const enrichedContracts = [
        { id: '1', name: 'Contract 1' },
        { id: '2', name: 'Contract 2' },
      ];
      const page = 1;
      const limit = 10;
      const totalItems = 25;

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = service.createPaginationResponse(
        enrichedContracts,
        page,
        limit,
        totalItems,
      );

      // Assert
      expect(result).toEqual({
        data: enrichedContracts,
        meta: {
          page: 1,
          limit: 10,
          totalItems: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      });
    });

    it('should handle last page correctly', () => {
      // Arrange
      const enrichedContracts = [{ id: '1' }];
      const page = 3;
      const limit = 10;
      const totalItems = 25;

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = service.createPaginationResponse(
        enrichedContracts,
        page,
        limit,
        totalItems,
      );

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('should handle single page correctly', () => {
      // Arrange
      const enrichedContracts = [{ id: '1' }];
      const page = 1;
      const limit = 10;
      const totalItems = 5;

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = service.createPaginationResponse(
        enrichedContracts,
        page,
        limit,
        totalItems,
      );

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
