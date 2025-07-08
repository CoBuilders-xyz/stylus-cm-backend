import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum BlockchainEventType {
  INSERT = 'InsertBid',
  DELETE = 'DeleteBid',
}

export class BlockchainEventsQueryDto {
  @IsUUID()
  @Type(() => String)
  blockchainId?: string;

  @IsOptional()
  @IsEnum(BlockchainEventType)
  eventType?: BlockchainEventType;
}
