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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SortDirection } from '../../common/dto/sort.dto';
import { ContractSortField } from '../../contracts/dto/contract-sorting.dto';
import { USER_CONTRACT_DEFAULTS } from '../constants';

export class GetUserContractsDto {
  @ApiProperty({ description: 'Blockchain UUID' })
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @IsNotEmpty()
  blockchainId: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1 })
  @IsOptional()
  @IsInt({ message: 'Page must be a valid integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @Type(() => Number)
  page?: number = USER_CONTRACT_DEFAULTS.PAGINATION.DEFAULT_PAGE;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1 })
  @IsOptional()
  @IsInt({ message: 'Limit must be a valid integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(USER_CONTRACT_DEFAULTS.PAGINATION.MAX_LIMIT, {
    message: `Limit cannot exceed ${USER_CONTRACT_DEFAULTS.PAGINATION.MAX_LIMIT}`,
  })
  @Type(() => Number)
  limit?: number = USER_CONTRACT_DEFAULTS.PAGINATION.DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'Search by contract address' })
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  @Length(1, 100, {
    message: 'Search term must be between 1 and 100 characters',
  })
  @Type(() => String)
  search?: string;

  @ApiPropertyOptional({ enum: ContractSortField, isArray: true, description: 'Sort fields' })
  @IsOptional()
  @IsArray({ message: 'SortBy must be an array' })
  @IsEnum(ContractSortField, {
    each: true,
    message: `Each sort field must be one of: ${Object.values(ContractSortField).join(', ')}`,
  })
  @Transform(({ value }: { value: string | ContractSortField[] }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as ContractSortField[];
    }
    return value;
  })
  sortBy?: ContractSortField[] = [ContractSortField.LAST_BID];

  @ApiPropertyOptional({ enum: SortDirection, isArray: true, description: 'Sort directions' })
  @IsOptional()
  @IsArray({ message: 'SortDirection must be an array' })
  @IsEnum(SortDirection, {
    each: true,
    message: `Each sort direction must be one of: ${Object.values(SortDirection).join(', ')}`,
  })
  @Transform(({ value }: { value: string | SortDirection[] }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()) as SortDirection[];
    }
    return value;
  })
  sortDirection?: SortDirection[] = [SortDirection.DESC];
}
