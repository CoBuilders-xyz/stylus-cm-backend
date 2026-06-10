import {
  Controller,
  Get,
  Patch,
  Body,
  NotFoundException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AlertsSettingsDto,
  TelegramSettingsDto,
  SlackSettingsDto,
  WebhookSettingsDto,
} from './dto/alerts-settings.dto';
import { AuthenticatedRequest } from '../common/types/custom-types';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('alerts-settings')
  @ApiOperation({ summary: 'Get notification channel settings for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Current alerts settings' })
  async getAlertsSettings(@Request() req: AuthenticatedRequest) {
    const settings = await this.usersService.getAlertsSettings(
      req.user.address,
    );
    return settings || {};
  }

  @Patch('alerts-settings')
  @ApiOperation({ summary: 'Update all notification channel settings at once' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
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

  @Patch('alerts-settings/telegram')
  @ApiOperation({ summary: 'Update Telegram notification settings' })
  @ApiResponse({ status: 200, description: 'Telegram settings updated' })
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
  @ApiOperation({ summary: 'Update Slack notification settings' })
  @ApiResponse({ status: 200, description: 'Slack settings updated' })
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
  @ApiOperation({ summary: 'Update Webhook notification settings' })
  @ApiResponse({ status: 200, description: 'Webhook settings updated' })
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
