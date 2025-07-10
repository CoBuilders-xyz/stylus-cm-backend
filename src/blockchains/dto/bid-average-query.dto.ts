import { IsEnum, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { TimespanType } from '../constants';

export class BidAverageQueryDto {
  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  maxSize?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  minSize?: number;
}
