import { Injectable } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { Alert } from './entities/alert.entity';
import { AlertCrudService } from './services/alert-crud.service';
import { createModuleLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from './constants';

@Injectable()
export class AlertsService {
  private readonly logger = createModuleLogger(AlertsService, MODULE_NAME);

  constructor(private readonly crudService: AlertCrudService) {}

  async getAlerts(user: User, blockchainId: string): Promise<Alert[]> {
    this.logger.debug(
      `Orchestrating getAlerts for user ${user.id} on blockchain ${blockchainId}`,
    );
    return this.crudService.getAlerts(user, blockchainId);
  }

  async getAlertsForUserContract(
    userId: string,
    userContractId: string,
  ): Promise<Alert[]> {
    return this.crudService.getAlertsForUserContract(userId, userContractId);
  }

  async createOrUpdateAlert(
    user: User,
    createAlertDto: CreateAlertDto,
  ): Promise<Alert> {
    this.logger.debug(
      `Orchestrating createOrUpdateAlert for user ${user.id} with alert type ${createAlertDto.type}`,
    );
    return this.crudService.createOrUpdateAlert(user, createAlertDto);
  }
}
