import { Injectable } from '@nestjs/common';
import { UserContract } from '../entities/user-contract.entity';
import { User } from '../../users/entities/user.entity';
import { ContractEnrichmentService } from '../../contracts/services/contract-enrichment.service';
import { AlertsService } from '../../alerts/alerts.service';
import { UserContractsErrorHelpers } from '../user-contracts.errors';
import { MODULE_NAME } from '../constants';
import { createModuleLogger } from '../../common/utils/logger.util';

@Injectable()
export class UserContractEnrichmentService {
  private readonly logger = createModuleLogger(
    UserContractEnrichmentService,
    MODULE_NAME,
  );

  constructor(
    private readonly contractEnrichmentService: ContractEnrichmentService,
    private readonly alertsService: AlertsService,
  ) {}

  async enrichUserContract(
    userContract: UserContract,
    user: User,
    includeDetailed: boolean = false,
  ): Promise<any> {
    try {
      // Get alerts for this user contract - exact same logic as original
      const alerts = await this.alertsService.getAlertsForUserContract(
        user.id,
        userContract.id,
      );

      // If the userContract has an associated contract, process it - exact same logic as original
      if (userContract.contract) {
        const processedContract =
          await this.contractEnrichmentService.processContract(
            userContract.contract,
            includeDetailed,
          );

        return {
          ...userContract,
          contract: processedContract,
          alerts,
        };
      }

      return {
        ...userContract,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to enrich user contract ${userContract.id}`,
        error,
      );
      UserContractsErrorHelpers.throwEnrichmentFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Unreachable');
    }
  }

  async enrichUserContracts(
    userContracts: UserContract[],
    user: User,
  ): Promise<any[]> {
    try {
      // Process contracts that have an associated contract - exact same logic as original
      const processedUserContracts = await Promise.all(
        userContracts.map((userContract) => {
          return this.enrichUserContract(userContract, user, false);
        }),
      );

      return processedUserContracts;
    } catch (error) {
      this.logger.error(
        `Failed to enrich user contracts for user ${user.id}`,
        error,
      );
      UserContractsErrorHelpers.throwEnrichmentFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Unreachable');
    }
  }

  createPaginationResponse(
    enrichedUserContracts: any[],
    page: number,
    limit: number,
    totalItems: number,
  ): any {
    // Calculate pagination metadata - exact same logic as original
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: enrichedUserContracts,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
