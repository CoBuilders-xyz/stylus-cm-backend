import { Controller, Get, Query, Req, Post, Body } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuthenticatedRequest } from 'src/common/types/custom-types';
import { CreateAlertDto } from './dto/create-alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // Get all alerts for a user
  // No use case yet
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('blockchainId') blockchainId: string,
  ) {
    return this.alertsService.getAlerts(req.user, blockchainId);
  }

  // Create or update an alert
  @Post()
  async createOrUpdateAlert(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateAlertDto,
  ) {
    return this.alertsService.createOrUpdateAlert(req.user, body);
  }
}
