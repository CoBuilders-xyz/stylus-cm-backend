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
      .leftJoin('alert.userContract', 'userContract')
      .leftJoin('userContract.blockchain', 'blockchain')
      .where('alert.user = :userId', { userId: user.id })
      .andWhere('blockchain.id = :blockchainId', { blockchainId });

    return queryBuilder.getMany();
  }

  async createAlert(user: User, createAlertDto: CreateAlertDto) {
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

    // Create alert
    const alert = this.alertsRepository.create(createAlertDto);

    // Set all required relationships
    alert.user = user;
    alert.userContract = userContract;

    return this.alertsRepository.save(alert);
  }
}
