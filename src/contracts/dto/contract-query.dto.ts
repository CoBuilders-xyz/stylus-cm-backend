import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ContractQueryDto {
  @ApiProperty({ description: 'Blockchain UUID to filter contracts' })
  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  blockchainId: string;
}
