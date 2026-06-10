import { IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchDto {
  @ApiPropertyOptional({ description: 'Search term (1-100 characters)' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Type(() => String)
  search?: string;
}
