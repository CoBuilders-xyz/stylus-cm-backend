import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TimespanType } from '../constants';

export class BidTrendsQueryDto {
  @ApiProperty({
    enum: TimespanType,
    description: 'Time window for the trend data',
  })
  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;
}
