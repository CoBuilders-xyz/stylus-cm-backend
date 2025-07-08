import { IsOptional, IsEnum } from 'class-validator';

export enum BlockchainEventSortField {
  BLOCK_TIMESTAMP = 'blockTimestamp',
  BLOCK_NUMBER = 'blockNumber',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class BlockchainEventsSortingDto {
  @IsOptional()
  @IsEnum(BlockchainEventSortField)
  sortBy?: BlockchainEventSortField = BlockchainEventSortField.BLOCK_TIMESTAMP;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
