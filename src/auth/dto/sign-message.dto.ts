import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignMessageDto {
  @ApiProperty({ description: 'Message to sign', example: 'Sign this nonce: abc123' })
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message is required' })
  @Length(1, 1000, {
    message: 'Message must be between 1 and 1000 characters',
  })
  message: string;

  @ApiProperty({ description: 'Private key (dev only)' })
  @IsString({ message: 'Private key must be a string' })
  @IsNotEmpty({ message: 'Private key is required' })
  @Length(64, 66, {
    message:
      'Private key must be 64 characters (without 0x) or 66 characters (with 0x)',
  })
  @Matches(/^(0x)?[a-fA-F0-9]{64}$/, {
    message: 'Private key must be a valid hexadecimal string',
  })
  pk: string;
}
