import { IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

// Define generic sort directions
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Generic sorting DTO to be extended by feature-specific DTOs
 * @template T - Enum type for sortable fields
 */
export class BaseSortingDto<T extends string> {
  @IsOptional()
  @Transform(({ value }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  sortBy?: T[] = [];

  @IsOptional()
  @IsEnum(SortDirection, { each: true })
  @Transform(({ value }) => {
    // Handle both array and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  sortDirection?: SortDirection[] = [];
}
