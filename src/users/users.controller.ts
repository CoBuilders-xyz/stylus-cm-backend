import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AlertsSettings } from './entities/user.entity';
import {
  AlertsSettingsDto,
  EmailSettingsDto,
  TelegramSettingsDto,
  SlackSettingsDto,
  WebhookSettingsDto,
} from './dto/alerts-settings.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':address/alerts-settings')
  async getAlertsSettings(@Param('address') address: string) {
    const settings = await this.usersService.getAlertsSettings(address);
    if (!settings) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return settings;
  }

  @Patch(':address/alerts-settings')
  async updateAlertsSettings(
    @Param('address') address: string,
    @Body() alertsSettings: AlertsSettingsDto,
  ) {
    const user = await this.usersService.updateAlertsSettings(
      address,
      alertsSettings,
    );
    if (!user) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return user.alertsSettings;
  }

  @Patch(':address/alerts-settings/email')
  async updateEmailSettings(
    @Param('address') address: string,
    @Body() settings: EmailSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      address,
      'emailSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return user.alertsSettings;
  }

  @Patch(':address/alerts-settings/telegram')
  async updateTelegramSettings(
    @Param('address') address: string,
    @Body() settings: TelegramSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      address,
      'telegramSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return user.alertsSettings;
  }

  @Patch(':address/alerts-settings/slack')
  async updateSlackSettings(
    @Param('address') address: string,
    @Body() settings: SlackSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      address,
      'slackSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return user.alertsSettings;
  }

  @Patch(':address/alerts-settings/webhook')
  async updateWebhookSettings(
    @Param('address') address: string,
    @Body() settings: WebhookSettingsDto,
  ) {
    const user = await this.usersService.updateAlertChannel(
      address,
      'webhookSettings',
      settings,
    );
    if (!user) {
      throw new NotFoundException(`User with address ${address} not found`);
    }
    return user.alertsSettings;
  }
}
