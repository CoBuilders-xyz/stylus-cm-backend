import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsChecksumAddress } from 'src/common/validators';

export class GenerateNonceDto {
  @ApiProperty({ description: 'Ethereum wallet address (EIP-55 checksum)', example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Address must be a valid Ethereum address starting with 0x',
  })
  @IsChecksumAddress({
    message:
      'Address must use proper EIP-55 checksum format for enhanced security',
  })
  address: string;
}
