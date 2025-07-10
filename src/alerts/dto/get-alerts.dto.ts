import { IsOptional, IsUUID, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { AlertType } from '../constants';

export class GetAlertsDto {
  @IsOptional()
  @IsUUID()
  blockchainId?: string;

  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }): boolean | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  userContractId?: string;
}
