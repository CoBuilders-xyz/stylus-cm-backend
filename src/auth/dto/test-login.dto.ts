import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestLoginDto {
  @ApiProperty({
    description: 'Ethereum wallet address (EIP-55 checksum)',
    example: '0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  address: string;

  @ApiProperty({
    description: 'Private key for the wallet (hex, with or without 0x prefix)',
    example:
      '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 66)
  @Matches(/^(0x)?[a-fA-F0-9]{64}$/, {
    message: 'Private key must be a valid hexadecimal string',
  })
  pk: string;
}
