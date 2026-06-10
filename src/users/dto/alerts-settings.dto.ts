import {
  IsBoolean,
  IsString,
  IsUrl,
  IsOptional,
  ValidateNested,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelegramSettingsDto {
  @ApiProperty({ description: 'Enable Telegram notifications' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Telegram chat ID', required: false })
  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when telegram alerts are enabled',
  })
  @IsString()
  destination: string;
}

export class SlackSettingsDto {
  @ApiProperty({ description: 'Enable Slack notifications' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Slack webhook URL or channel', required: false })
  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when slack alerts are enabled',
  })
  @IsString()
  destination: string;
}

export class WebhookSettingsDto {
  @ApiProperty({ description: 'Enable Webhook notifications' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Webhook URL endpoint', required: false })
  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty({
    message: 'Destination is required when webhook alerts are enabled',
  })
  @IsUrl()
  destination: string;
}

export class AlertsSettingsDto {
  @ApiPropertyOptional({ type: TelegramSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramSettingsDto)
  telegramSettings?: TelegramSettingsDto;

  @ApiPropertyOptional({ type: SlackSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SlackSettingsDto)
  slackSettings?: SlackSettingsDto;

  @ApiPropertyOptional({ type: WebhookSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookSettingsDto)
  webhookSettings?: WebhookSettingsDto;
}
