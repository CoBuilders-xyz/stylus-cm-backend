import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BlockchainEventSortField {
  BLOCK_TIMESTAMP = 'blockTimestamp',
  BLOCK_NUMBER = 'blockNumber',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class BlockchainEventsSortingDto {
  @ApiPropertyOptional({ enum: BlockchainEventSortField, default: BlockchainEventSortField.BLOCK_TIMESTAMP })
  @IsOptional()
  @IsEnum(BlockchainEventSortField)
  sortBy?: BlockchainEventSortField = BlockchainEventSortField.BLOCK_TIMESTAMP;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
