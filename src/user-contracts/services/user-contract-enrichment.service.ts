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
    this.logger.log(
      `Enriching user contract ${userContract.id} for user ${user.id}${includeDetailed ? ' (detailed)' : ''}`,
    );

    try {
      // Get alerts for this user contract - exact same logic as original
      const alerts = await this.alertsService.getAlertsForUserContract(
        user.id,
        userContract.id,
      );

      this.logger.debug(
        `Retrieved ${alerts.length} alerts for user contract ${userContract.id}`,
      );

      // If the userContract has an associated contract, process it - exact same logic as original
      if (userContract.contract) {
        this.logger.debug(
          `Processing associated contract ${userContract.contract.id} for user contract ${userContract.id}`,
        );

        const processedContract =
          await this.contractEnrichmentService.processContract(
            userContract.contract,
            includeDetailed,
          );

        this.logger.log(
          `Successfully enriched user contract ${userContract.id} with contract data for user ${user.id}`,
        );

        return {
          ...userContract,
          contract: processedContract,
          alerts,
        };
      }

      this.logger.log(
        `Successfully enriched user contract ${userContract.id} for user ${user.id}`,
      );

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
    this.logger.log(
      `Enriching ${userContracts.length} user contracts for user ${user.id}`,
    );

    try {
      // Process contracts that have an associated contract - exact same logic as original
      const processedUserContracts = await Promise.all(
        userContracts.map((userContract) => {
          return this.enrichUserContract(userContract, user, false);
        }),
      );

      this.logger.log(
        `Successfully enriched ${processedUserContracts.length} user contracts for user ${user.id}`,
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
    this.logger.debug(
      `Creating pagination response: ${enrichedUserContracts.length} items, page ${page}, limit ${limit}, total ${totalItems}`,
    );

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
