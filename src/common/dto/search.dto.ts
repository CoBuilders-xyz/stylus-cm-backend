import { IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

// max length 100
export class SearchDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Type(() => String)
  search?: string;
}
