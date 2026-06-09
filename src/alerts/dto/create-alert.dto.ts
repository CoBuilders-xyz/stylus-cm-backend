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
import { AlertType } from '../constants';

export class CreateAlertDto {
  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

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
  value: string; // validated as number saved as string for more generic values

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userContractId: string;

  @IsOptional()
  @IsBoolean()
  slackChannelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  telegramChannelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookChannelEnabled?: boolean;
}
