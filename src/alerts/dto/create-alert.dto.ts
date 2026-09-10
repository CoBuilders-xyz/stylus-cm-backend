import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsEnum,
  ValidateIf,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType } from '../constants';

export class CreateAlertDto {
  @ApiProperty({ enum: AlertType, description: 'Type of alert to create' })
  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

  @ApiPropertyOptional({
    description:
      'Threshold value (required for bidSafety, lowGas, approachingExpiration)',
    type: Number,
  })
  @ValidateIf(
    (o: CreateAlertDto) =>
      o.type === AlertType.BID_SAFETY ||
      o.type === AlertType.LOW_GAS ||
      o.type === AlertType.APPROACHING_EXPIRATION,
  )
  @IsNotEmpty({
    message:
      'Value is required when alert type is bidSafety, lowGas, or approachingExpiration',
  })
  @IsNumber(
    {},
    {
      message:
        'Value must be a number when alert type is bidSafety, lowGas, or approachingExpiration',
    },
  )
  @IsPositive({ message: 'Value must be positive' })
  value: string;

  @ApiProperty({ description: 'Whether the alert is active' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @ApiProperty({ description: 'UUID of the user contract to monitor' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userContractId: string;

  @ApiPropertyOptional({
    description: 'Enable Slack notifications for this alert',
  })
  @IsOptional()
  @IsBoolean()
  slackChannelEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable Telegram notifications for this alert',
  })
  @IsOptional()
  @IsBoolean()
  telegramChannelEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable Webhook notifications for this alert',
  })
  @IsOptional()
  @IsBoolean()
  webhookChannelEnabled?: boolean;
}
