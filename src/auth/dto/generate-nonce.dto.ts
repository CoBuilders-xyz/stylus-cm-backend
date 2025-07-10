import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { IsChecksumAddress } from 'src/common/validators';

export class GenerateNonceDto {
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
