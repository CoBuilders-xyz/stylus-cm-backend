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

/**
 * DTO for getting user contracts with all query parameters consolidated
 */
export class GetUserContractsDto {
  // Blockchain ID (required)
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @IsNotEmpty()
  blockchainId: string;

  // Pagination parameters
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  // Search parameters
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Type(() => String)
  search?: string;

  // Sorting parameters
  @IsOptional()
  @IsArray()
  @IsEnum(ContractSortField, { each: true })
  @Transform(({ value }: { value: string | ContractSortField[] }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as ContractSortField[];
    }
    return value;
  })
  sortBy?: ContractSortField[] = [ContractSortField.LAST_BID];

  @IsOptional()
  @IsArray()
  @IsEnum(SortDirection, { each: true })
  @Transform(({ value }: { value: string | SortDirection[] }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as SortDirection[];
    }
    return value;
  })
  sortDirection?: SortDirection[] = [SortDirection.DESC];
}
