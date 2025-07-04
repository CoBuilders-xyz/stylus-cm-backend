import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SortDirection } from '../../common/dto/sort.dto';
import { ContractSortField } from '../../contracts/dto/contract-sorting.dto';
import { USER_CONTRACT_DEFAULTS } from '../constants';

/**
 * DTO for getting user contracts with comprehensive query parameters
 */
export class GetUserContractsDto {
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @IsNotEmpty()
  blockchainId: string;

  @IsOptional()
  @IsInt({ message: 'Page must be a valid integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page?: number = USER_CONTRACT_DEFAULTS.PAGINATION.DEFAULT_PAGE;

  @IsOptional()
  @IsInt({ message: 'Limit must be a valid integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(USER_CONTRACT_DEFAULTS.PAGINATION.MAX_LIMIT, {
    message: `Limit cannot exceed ${USER_CONTRACT_DEFAULTS.PAGINATION.MAX_LIMIT}`,
  })
  @Type(() => Number)
  limit?: number = USER_CONTRACT_DEFAULTS.PAGINATION.DEFAULT_LIMIT;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  @Length(1, 100, {
    message: 'Search term must be between 1 and 100 characters',
  })
  @Type(() => String)
  search?: string;

  @IsOptional()
  @IsArray({ message: 'SortBy must be an array' })
  @IsEnum(ContractSortField, {
    each: true,
    message: `Each sort field must be one of: ${Object.values(ContractSortField).join(', ')}`,
  })
  @Transform(({ value }: { value: string | ContractSortField[] }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as ContractSortField[];
    }
    return value;
  })
  sortBy?: ContractSortField[] = [ContractSortField.LAST_BID];

  @IsOptional()
  @IsArray({ message: 'SortDirection must be an array' })
  @IsEnum(SortDirection, {
    each: true,
    message: `Each sort direction must be one of: ${Object.values(SortDirection).join(', ')}`,
  })
  @Transform(({ value }: { value: string | SortDirection[] }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as SortDirection[];
    }
    return value;
  })
  sortDirection?: SortDirection[] = [SortDirection.DESC];
}
