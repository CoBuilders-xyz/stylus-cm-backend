import { IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ContractQueryDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  blockchainId: string;
}
