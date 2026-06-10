import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBlockchainDto {
  @ApiProperty({ description: 'Blockchain UUID' })
  @IsUUID()
  @IsNotEmpty()
  blockchainId: string;
}
