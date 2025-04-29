import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { User } from 'src/users/entities/user.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UserContract } from 'src/user-contracts/entities/user-contract.entity';
@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    @InjectRepository(UserContract)
    private userContractsRepository: Repository<UserContract>,
  ) {}

  async getAlerts(user: User, blockchainId: string) {
    // use query builder for leftJoining userContracts and check blockchainId
    const queryBuilder = this.alertsRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.userContract', 'userContract')
      .leftJoinAndSelect('userContract.blockchain', 'blockchain')
      .where('alert.user = :userId', { userId: user.id })
      .andWhere('blockchain.id = :blockchainId', { blockchainId });

    return queryBuilder.getMany();
  }

  async getAlertsForUserContract(userId: string, userContractId: string) {
    // Query alerts for a specific user contract
    const queryBuilder = this.alertsRepository
      .createQueryBuilder('alert')
      .where('alert.user = :userId', { userId })
      .andWhere('alert.userContract = :userContractId', { userContractId });

    return queryBuilder.getMany();
  }

  async createOrUpdateAlert(user: User, createAlertDto: CreateAlertDto) {
    // Validate userContract exists on blockchain
    const userContract = await this.userContractsRepository.findOne({
      where: {
        id: createAlertDto.userContractId,
      },
      relations: ['blockchain'],
    });

    if (!userContract) {
      throw new NotFoundException('User contract not found');
    }

    // Check if an alert of this type already exists for this user and contract
    const existingAlert = await this.alertsRepository.findOne({
      where: {
        user: { id: user.id },
        userContract: { id: createAlertDto.userContractId },
        type: createAlertDto.type,
      },
    });

    // If the alert already exists, update it instead of creating a new one
    if (existingAlert) {
      // Update properties from the DTO
      existingAlert.value = createAlertDto.value;
      existingAlert.isActive = createAlertDto.isActive;

      // Update notification channels if provided
      if (createAlertDto.emailChannelEnabled !== undefined) {
        existingAlert.emailChannelEnabled = createAlertDto.emailChannelEnabled;
      }
      if (createAlertDto.slackChannelEnabled !== undefined) {
        existingAlert.slackChannelEnabled = createAlertDto.slackChannelEnabled;
      }
      if (createAlertDto.telegramChannelEnabled !== undefined) {
        existingAlert.telegramChannelEnabled =
          createAlertDto.telegramChannelEnabled;
      }
      if (createAlertDto.webhookChannelEnabled !== undefined) {
        existingAlert.webhookChannelEnabled =
          createAlertDto.webhookChannelEnabled;
      }

      return this.alertsRepository.save(existingAlert);
    }

    // Create alert
    const alert = this.alertsRepository.create(createAlertDto);

    // Set all required relationships
    alert.user = user;
    alert.userContract = userContract;

    return this.alertsRepository.save(alert);
  }
}
