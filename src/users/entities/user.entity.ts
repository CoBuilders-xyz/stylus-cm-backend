import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export interface EmailSettings {
  enabled: boolean;
  destination: string;
}

export interface TelegramSettings {
  enabled: boolean;
  destination: string;
}

export interface SlackSettings {
  enabled: boolean;
  destination: string;
}

export interface WebhookSettings {
  enabled: boolean;
  destination: string;
}

export interface AlertsSettings {
  emailSettings?: EmailSettings;
  telegramSettings?: TelegramSettings;
  slackSettings?: SlackSettings;
  webhookSettings?: WebhookSettings;
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  alertsSettings: AlertsSettings;
}
