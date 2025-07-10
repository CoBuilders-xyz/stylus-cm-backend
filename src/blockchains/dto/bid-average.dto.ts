import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TimespanType } from '../constants';

export class BidAverageDto {
  @IsUUID()
  @IsNotEmpty()
  blockchainId: string;

  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  maxSize?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  minSize?: number;
}
