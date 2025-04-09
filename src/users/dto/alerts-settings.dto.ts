import {
  IsBoolean,
  IsString,
  IsEmail,
  IsUrl,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EmailSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsEmail()
  @IsOptional()
  destination: string;
}

export class TelegramSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsOptional()
  destination: string;
}

export class SlackSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsOptional()
  destination: string;
}

export class WebhookSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsUrl()
  @IsOptional()
  destination: string;
}

export class AlertsSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailSettingsDto)
  emailSettings?: EmailSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramSettingsDto)
  telegramSettings?: TelegramSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SlackSettingsDto)
  slackSettings?: SlackSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookSettingsDto)
  webhookSettings?: WebhookSettingsDto;
}
