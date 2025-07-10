import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { CreateAlertDto } from '../dto/create-alert.dto';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from '../constants';
import { AlertsErrorHelpers } from '../alerts.errors';

@Injectable()
export class AlertCrudService {
  private readonly logger = createModuleLogger(AlertCrudService, MODULE_NAME);

  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {}

  async getAlerts(user: User, blockchainId: string): Promise<Alert[]> {
    try {
      this.logger.debug(
        `Getting alerts for user ${user.id} on blockchain ${blockchainId}`,
      );

      const queryBuilder = this.alertsRepository
        .createQueryBuilder('alert')
        .leftJoinAndSelect('alert.userContract', 'userContract')
        .leftJoinAndSelect('userContract.blockchain', 'blockchain')
        .where('alert.user = :userId', { userId: user.id })
        .andWhere('blockchain.id = :blockchainId', { blockchainId });

      const alerts = await queryBuilder.getMany();

      this.logger.log(
        `Found ${alerts.length} alerts for user ${user.id} on blockchain ${blockchainId}`,
      );

      return alerts;
    } catch (error) {
      this.logger.error(
        `Error getting alerts for user ${user.id} on blockchain ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getAlertsForUserContract(
    userId: string,
    userContractId: string,
  ): Promise<Alert[]> {
    try {
      const queryBuilder = this.alertsRepository
        .createQueryBuilder('alert')
        .where('alert.user = :userId', { userId })
        .andWhere('alert.userContract = :userContractId', { userContractId });

      const alerts = await queryBuilder.getMany();

      this.logger.log(
        `Found ${alerts.length} alerts for user ${userId} and contract ${userContractId}`,
      );

      return alerts;
    } catch (error) {
      this.logger.error(
        `Error getting alerts for user ${userId} and contract ${userContractId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async createOrUpdateAlert(
    user: User,
    createAlertDto: CreateAlertDto,
  ): Promise<Alert> {
    try {
      this.logger.debug(
        `Creating or updating alert of type ${createAlertDto.type} for user ${user.id}`,
      );

      // Validate userContract exists
      const userContract = await this.userContractsRepository.findOne({
        where: {
          id: createAlertDto.userContractId,
        },
        relations: ['blockchain'],
      });

      if (!userContract) {
        this.logger.warn(
          `User contract ${createAlertDto.userContractId} not found`,
        );
        AlertsErrorHelpers.throwUserContractNotFound(
          createAlertDto.userContractId,
        );
      }

      // Check if an alert of this type already exists for this user and contract
      const existingAlert = await this.alertsRepository.findOne({
        where: {
          user: { id: user.id },
          userContract: { id: createAlertDto.userContractId },
          type: createAlertDto.type,
        },
      });

      if (existingAlert) {
        this.logger.debug(
          `Updating existing alert ${existingAlert.id} for user ${user.id}`,
        );

        // Update properties from the DTO
        existingAlert.value = createAlertDto.value;
        existingAlert.isActive = createAlertDto.isActive;

        // Update notification channels if provided
        if (createAlertDto.emailChannelEnabled !== undefined) {
          existingAlert.emailChannelEnabled =
            createAlertDto.emailChannelEnabled;
        }
        if (createAlertDto.slackChannelEnabled !== undefined) {
          existingAlert.slackChannelEnabled =
            createAlertDto.slackChannelEnabled;
        }
        if (createAlertDto.telegramChannelEnabled !== undefined) {
          existingAlert.telegramChannelEnabled =
            createAlertDto.telegramChannelEnabled;
        }
        if (createAlertDto.webhookChannelEnabled !== undefined) {
          existingAlert.webhookChannelEnabled =
            createAlertDto.webhookChannelEnabled;
        }

        const savedAlert = await this.alertsRepository.save(existingAlert);
        this.logger.log(
          `Successfully updated alert ${savedAlert.id} for user ${user.id}`,
        );
        return savedAlert;
      }

      // Create new alert
      const alert = this.alertsRepository.create(createAlertDto);
      alert.user = user;
      alert.userContract = userContract!;

      const savedAlert = await this.alertsRepository.save(alert);
      this.logger.log(
        `Successfully created alert ${savedAlert.id} for user ${user.id}`,
      );

      return savedAlert;
    } catch (error) {
      this.logger.error(
        `Error creating or updating alert for user ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
