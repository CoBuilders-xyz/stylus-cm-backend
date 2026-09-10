import { IsString, IsNotEmpty, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SuggestedBidsByAddressParamsDto {
  @ApiProperty({
    description: 'Ethereum contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a valid Ethereum address',
  })
  address: string;
}

export class SuggestedBidsQueryDto {
  @ApiProperty({ description: 'Blockchain UUID' })
  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  blockchainId: string;
}
