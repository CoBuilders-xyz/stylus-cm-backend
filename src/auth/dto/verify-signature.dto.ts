import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifySignatureDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Address must be a valid Ethereum address starting with 0x',
  })
  address: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

//TODO Maybe add checksum address validation
