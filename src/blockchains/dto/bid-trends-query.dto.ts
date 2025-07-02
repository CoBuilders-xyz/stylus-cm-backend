import { IsEnum, IsNotEmpty } from 'class-validator';
import { TimespanType } from '../constants';

export class BidTrendsQueryDto {
  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;
}
