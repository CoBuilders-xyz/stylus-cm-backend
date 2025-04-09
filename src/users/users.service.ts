import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AlertsSettings } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  findOne(address: string) {
    return this.usersRepository.findOne({ where: { address } });
  }

  create(address: string) {
    const newUser = this.usersRepository.create({ address });
    return this.usersRepository.save(newUser);
  }

  findOrCreate(address: string) {
    const user = this.findOne(address);
    if (user) {
      return user;
    }
    const newUser = this.create(address);
    return newUser;
  }

  async updateAlertsSettings(address: string, alertsSettings: AlertsSettings) {
    const user = await this.findOne(address);
    if (!user) {
      return null;
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
