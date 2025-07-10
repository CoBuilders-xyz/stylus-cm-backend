import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  AlertsSettings,
  NotificationChannelSettings,
  AlertChannelKey,
} from './interfaces/alerts-settings.interface';
import { UsersErrorHelpers } from './users.errors';
import { createModuleLogger } from '../common/utils/logger.util';
import { MODULE_NAME } from './constants';

@Injectable()
export class UsersService {
  private readonly logger = createModuleLogger(UsersService, MODULE_NAME);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  /**
   * Find a user by their Ethereum address
   * @param address - The Ethereum address to search for
   * @returns The user if found, null otherwise
   */
  async findOne(address: string): Promise<User | null> {
    try {
      this.logger.log(`Finding user with address: ${address}`);
      const user = await this.usersRepository.findOne({ where: { address } });

      if (user) {
        this.logger.log(`User found: ${user.id}`);
      } else {
        this.logger.log(`User not found for address: ${address}`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to find user with address: ${address}`, error);
      throw error;
    }
  }

  /**
   * Create a new user with the given address
   * @param address - The Ethereum address for the new user
   * @returns The created user
   */
  async create(address: string): Promise<User> {
    try {
      this.logger.log(`Creating new user with address: ${address}`);

      const newUser = this.usersRepository.create({
        address,
        alertsSettings: {},
      });

      const savedUser = await this.usersRepository.save(newUser);
      this.logger.log(`User created successfully: ${savedUser.id}`);

      return savedUser;
    } catch (error) {
      this.logger.error(
        `Failed to create user with address: ${address}`,
        error,
      );
      return UsersErrorHelpers.throwUserCreationFailed();
    }
  }

  /**
   * Find an existing user or create a new one if not found
   * @param address - The Ethereum address to find or create
   * @returns The found or created user
   */
  async findOrCreate(address: string): Promise<User> {
    try {
      this.logger.log(`Finding or creating user with address: ${address}`);

      const user = await this.findOne(address);
      if (user) {
        this.logger.log(`Existing user found: ${user.id}`);
        return user;
      }

      this.logger.log(`User not found, creating new user`);
      return this.create(address);
    } catch (error) {
      this.logger.error(
        `Failed to find or create user with address: ${address}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update all alerts settings for a user
   * @param address - The user's Ethereum address
   * @param alertsSettings - The new alerts settings
   * @returns The updated user or null if user not found
   */
  async updateAlertsSettings(
    address: string,
    alertsSettings: AlertsSettings,
  ): Promise<User | null> {
    try {
      this.logger.log(`Updating alerts settings for user: ${address}`);

      const user = await this.findOne(address);
      if (!user) {
        this.logger.log(
          `User not found for alerts settings update: ${address}`,
        );
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
      const savedUser = await this.usersRepository.save(user);

      this.logger.log(
        `Alerts settings updated successfully for user: ${user.id}`,
      );
      return savedUser;
    } catch (error) {
      this.logger.error(
        `Failed to update alerts settings for user: ${address}`,
        error,
      );
      return UsersErrorHelpers.throwAlertsSettingsUpdateFailed();
    }
  }

  /**
   * Update a specific alert channel for a user
   * @param address - The user's Ethereum address
   * @param channel - The specific channel to update
   * @param settings - The new settings for the channel
   * @returns The updated user or null if user not found
   */
  async updateAlertChannel(
    address: string,
    channel: AlertChannelKey,
    settings: NotificationChannelSettings,
  ): Promise<User | null> {
    try {
      this.logger.log(`Updating ${channel} for user: ${address}`);

      const user = await this.findOne(address);
      if (!user) {
        this.logger.log(`User not found for channel update: ${address}`);
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
      const savedUser = await this.usersRepository.save(user);

      this.logger.log(
        `Channel ${channel} updated successfully for user: ${user.id}`,
      );
      return savedUser;
    } catch (error) {
      this.logger.error(
        `Failed to update ${channel} for user: ${address}`,
        error,
      );
      return UsersErrorHelpers.throwAlertsSettingsUpdateFailed();
    }
  }

  /**
   * Get alerts settings for a user
   * @param address - The user's Ethereum address
   * @returns The user's alerts settings or null if user not found
   */
  async getAlertsSettings(address: string): Promise<AlertsSettings | null> {
    try {
      this.logger.log(`Getting alerts settings for user: ${address}`);

      const user = await this.findOne(address);
      if (!user) {
        this.logger.log(
          `User not found for alerts settings retrieval: ${address}`,
        );
        return null;
      }

      const settings = user.alertsSettings || {};
      this.logger.log(
        `Alerts settings retrieved successfully for user: ${user.id}`,
      );

      return settings;
    } catch (error) {
      this.logger.error(
        `Failed to get alerts settings for user: ${address}`,
        error,
      );
      return UsersErrorHelpers.throwAlertsSettingsRetrievalFailed();
    }
  }
}
