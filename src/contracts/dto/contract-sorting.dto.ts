import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseSortingDto } from '../../common/dto/sort.dto';

export enum ContractSortField {
  LAST_BID = 'contract.lastBid',
  BYTECODE_SIZE = 'bytecode.size',
  IS_CACHED = 'bytecode.isCached',
  TOTAL_BID_INVESTMENT = 'contract.totalBidInvestment',
}

export enum ContractSortFieldNumeric {
  LAST_BID = 'contract.lastBid',
  BYTECODE_SIZE = 'bytecode.size',
  TOTAL_BID_INVESTMENT = 'contract.totalBidInvestment',
}

export class ContractSortingDto extends BaseSortingDto<ContractSortField> {
  @ApiPropertyOptional({ enum: ContractSortField, isArray: true, description: 'Fields to sort by' })
  @IsOptional()
  @IsEnum(ContractSortField, { each: true })
  sortBy?: ContractSortField[] = [ContractSortField.LAST_BID];
}
