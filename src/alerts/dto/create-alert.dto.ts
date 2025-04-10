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

import { AlertType } from '../entities/alert.entity';

export class CreateAlertDto {
  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

  @ValidateIf((o: CreateAlertDto) => o.type === AlertType.BID_SAFETY)
  @IsNotEmpty({ message: 'Value is required when alert type is bidSafety' })
  @IsNumber(
    {},
    { message: 'Value must be a number when alert type is bidSafety' },
  )
  @IsPositive()
  value: string; // validated as number saved as string for more generic values

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
