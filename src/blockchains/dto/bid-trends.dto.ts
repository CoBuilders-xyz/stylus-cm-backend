import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { TimespanType } from '../constants';

export class BidTrendsDto {
  @IsUUID()
  @IsNotEmpty()
  blockchainId: string;

  @IsEnum(TimespanType)
  @IsNotEmpty()
  timespan: TimespanType;
}
