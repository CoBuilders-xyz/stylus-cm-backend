import { IsEnum, IsOptional } from 'class-validator';
import { BaseSortingDto } from '../../common/dto/sort.dto';

// Define the valid sort fields for contracts
export enum ContractSortField {
  LAST_BID = 'contract.lastBid',
  BYTECODE_SIZE = 'bytecode.size',
  IS_CACHED = 'bytecode.isCached',
  TOTAL_BID_INVESTMENT = 'contract.totalBidInvestment',
}

export class ContractSortingDto extends BaseSortingDto<ContractSortField> {
  @IsOptional()
  @IsEnum(ContractSortField, { each: true })
  sortBy?: ContractSortField[] = [ContractSortField.LAST_BID];
}
