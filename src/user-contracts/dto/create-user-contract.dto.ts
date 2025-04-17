import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreateUserContractDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Address must be a valid Ethereum address starting with 0x',
  })
  address: string;

  @IsString()
  @IsNotEmpty()
  blockchainId: string;

  @IsString()
  @IsOptional()
  name: string;

  @IsNumber()
  @IsOptional()
  maxBid: number;
}
