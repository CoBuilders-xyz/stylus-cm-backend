import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsEnum,
} from 'class-validator';

import { AlertType } from '../entities/alert.entity';

export class CreateAlertDto {
  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

  @IsString()
  @IsOptional()
  value: string;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userContractId: string;

  @IsBoolean()
  @IsOptional()
  emailChannelEnabled: boolean;

  @IsBoolean()
  @IsOptional()
  slackChannelEnabled: boolean;

  @IsBoolean()
  @IsOptional()
  telegramChannelEnabled: boolean;

  @IsBoolean()
  @IsOptional()
  webhookChannelEnabled: boolean;
}
