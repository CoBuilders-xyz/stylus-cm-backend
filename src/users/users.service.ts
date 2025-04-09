import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AlertsSettings } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async findOne(address: string) {
    return this.usersRepository.findOne({ where: { address } });
  }

  async create(address: string) {
    const newUser = this.usersRepository.create({
      address,
      alertsSettings: {},
    });
    return this.usersRepository.save(newUser);
  }

  async findOrCreate(address: string) {
    const user = await this.findOne(address);
    if (user) {
      return user;
    }
    return this.create(address);
  }

  async updateAlertsSettings(address: string, alertsSettings: AlertsSettings) {
    const user = await this.findOne(address);
    if (!user) {
      return null;
    }

    // If existing settings, we need to preserve destination fields for disabled channels
    if (user.alertsSettings) {
      // For each channel, if it's being set to disabled, preserve the destination
      for (const channel of [
        'emailSettings',
        'telegramSettings',
        'slackSettings',
        'webhookSettings',
      ] as const) {
        if (
          alertsSettings[channel] &&
          alertsSettings[channel].enabled === false &&
          !alertsSettings[channel].destination &&
          user.alertsSettings[channel] &&
          user.alertsSettings[channel].destination
        ) {
          alertsSettings[channel].destination =
            user.alertsSettings[channel].destination;
        }
      }
    }

    user.alertsSettings = alertsSettings;
    return this.usersRepository.save(user);
  }

  async updateAlertChannel(
    address: string,
    channel: keyof AlertsSettings,
    settings: any,
  ) {
    const user = await this.findOne(address);
    if (!user) {
      return null;
    }

    if (!user.alertsSettings) {
      user.alertsSettings = {};
    }

    // If the setting is being disabled but no destination is provided,
    // keep the existing destination value
    if (
      settings.enabled === false &&
      !settings.destination &&
      user.alertsSettings[channel] &&
      user.alertsSettings[channel].destination
    ) {
      settings.destination = user.alertsSettings[channel].destination;
    }

    user.alertsSettings[channel] = settings;
    return this.usersRepository.save(user);
  }

  async getAlertsSettings(address: string) {
    const user = await this.findOne(address);
    if (!user) {
      return null;
    }

    return user.alertsSettings || {};
  }
}
