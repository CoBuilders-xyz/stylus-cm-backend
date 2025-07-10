import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class ContractQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  blockchainId: string;
}
