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
  Min,
  Max,
} from 'class-validator';
import { AlertType, ALERT_THRESHOLDS } from '../constants';

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
  @IsPositive({ message: 'Value must be positive for bidSafety alerts' })
  @Min(ALERT_THRESHOLDS.MIN_BID_SAFETY_VALUE, {
    message: `Minimum bid safety value is ${ALERT_THRESHOLDS.MIN_BID_SAFETY_VALUE}%`,
  })
  @Max(ALERT_THRESHOLDS.MAX_BID_SAFETY_VALUE, {
    message: `Maximum bid safety value is ${ALERT_THRESHOLDS.MAX_BID_SAFETY_VALUE}%`,
  })
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
