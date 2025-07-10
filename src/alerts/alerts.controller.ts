import {
  Controller,
  Get,
  Query,
  Req,
  Post,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';
import { CreateAlertDto } from './dto/create-alert.dto';
import { createControllerLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from './constants';
import { Alert } from './entities/alert.entity';

@Controller('alerts')
export class AlertsController {
  private readonly logger = createControllerLogger(
    AlertsController,
    MODULE_NAME,
  );

  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Get all alerts for a user
   */
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('blockchainId') blockchainId: string,
  ): Promise<Alert[]> {
    try {
      this.logger.debug(
        `Getting alerts for user ${req.user.id} on blockchain ${blockchainId}`,
      );

      const alerts = await this.alertsService.getAlerts(req.user, blockchainId);

      this.logger.log(
        `Successfully retrieved ${alerts.length} alerts for user ${req.user.id}`,
      );

      return alerts;
    } catch (error) {
      this.logger.error(
        `Error getting alerts for user ${req.user.id} on blockchain ${blockchainId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Create or update an alert
   */
  @Post()
  async createOrUpdateAlert(
    @Req() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true })) body: CreateAlertDto,
  ): Promise<Alert> {
    try {
      this.logger.debug(
        `Creating/updating alert of type ${body.type} for user ${req.user.id}`,
      );

      const alert = await this.alertsService.createOrUpdateAlert(
        req.user,
        body,
      );

      this.logger.log(
        `Successfully created/updated alert ${alert.id} for user ${req.user.id}`,
      );

      return alert;
    } catch (error) {
      this.logger.error(
        `Error creating/updating alert for user ${req.user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
