import {
  Controller,
  Get,
  Patch,
  Body,
  NotFoundException,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  AlertsSettingsDto,
  EmailSettingsDto,
  TelegramSettingsDto,
  SlackSettingsDto,
  WebhookSettingsDto,
} from './dto/alerts-settings.dto';
import { AuthenticatedRequest } from '../common/types/custom-types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('alerts-settings')
  async getAlertsSettings(@Request() req: AuthenticatedRequest) {
    const settings = await this.usersService.getAlertsSettings(
      req.user.address,
    );
    return settings || {};
  }

  @Patch('alerts-settings')
  async updateAlertsSettings(
    @Request() req: AuthenticatedRequest,
    @Body() alertsSettings: AlertsSettingsDto,
  ) {
    const user = await this.usersService.updateAlertsSettings(
      req.user.address,
      alertsSettings,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user.alertsSettings;
  }

  @Patch('alerts-settings/email')
  async updateEmailSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: EmailSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      req.user.address,
      'emailSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user.alertsSettings;
  }

  @Patch('alerts-settings/telegram')
  async updateTelegramSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: TelegramSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      req.user.address,
      'telegramSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user.alertsSettings;
  }

  @Patch('alerts-settings/slack')
  async updateSlackSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: SlackSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      req.user.address,
      'slackSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user.alertsSettings;
  }

  @Patch('alerts-settings/webhook')
  async updateWebhookSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: WebhookSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      req.user.address,
      'webhookSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user.alertsSettings;
  }
}
