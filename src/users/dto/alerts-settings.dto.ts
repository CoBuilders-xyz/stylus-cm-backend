import {
  IsBoolean,
  IsString,
  IsEmail,
  IsUrl,
  IsOptional,
  ValidateNested,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EmailSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when email alerts are enabled',
  })
  @IsEmail()
  destination: string;
}

export class TelegramSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when telegram alerts are enabled',
  })
  @IsString()
  destination: string;
}

export class SlackSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when slack alerts are enabled',
  })
  @IsString()
  destination: string;
}

export class WebhookSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when webhook alerts are enabled',
  })
  @IsUrl()
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
