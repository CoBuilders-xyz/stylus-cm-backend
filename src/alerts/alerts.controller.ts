import {
  Controller,
  Get,
  Query,
  Req,
  Post,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';
import { CreateAlertDto } from './dto/create-alert.dto';
import { createControllerLogger } from 'src/common/utils/logger.util';
import { MODULE_NAME } from './constants';
import { Alert } from './entities/alert.entity';

@ApiTags('Alerts')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'List all alerts for the authenticated user' })
  @ApiQuery({
    name: 'blockchainId',
    description: 'Filter by blockchain UUID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Array of user alerts' })
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
  @ApiOperation({ summary: 'Create or update an alert on a user contract' })
  @ApiResponse({ status: 201, description: 'Alert created or updated' })
  @ApiResponse({ status: 400, description: 'Invalid alert parameters' })
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
