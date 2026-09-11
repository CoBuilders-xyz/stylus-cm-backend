import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BlockchainEventType {
  INSERT = 'InsertBid',
  DELETE = 'DeleteBid',
  ACTIVATION_PERFORMED = 'ActivationPerformed',
  ACTIVATION_ERROR = 'ActivationError',
}

export class BlockchainEventsQueryDto {
  @ApiProperty({ description: 'Blockchain UUID to filter events' })
  @IsUUID()
  @Type(() => String)
  blockchainId: string;

  @ApiPropertyOptional({
    enum: BlockchainEventType,
    description: 'Filter by event type',
  })
  @IsOptional()
  @IsEnum(BlockchainEventType)
  eventType?: BlockchainEventType;
}
