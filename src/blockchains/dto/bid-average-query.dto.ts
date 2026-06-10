import { IsEnum, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimespanType } from '../constants';

export class BidAverageQueryDto {
  @ApiProperty({ enum: TimespanType, description: 'Time window for the average' })
  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;

  @ApiPropertyOptional({ description: 'Maximum bytecode size filter (KB)', minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  maxSize?: number;

  @ApiPropertyOptional({ description: 'Minimum bytecode size filter (KB)', minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  minSize?: number;
}
