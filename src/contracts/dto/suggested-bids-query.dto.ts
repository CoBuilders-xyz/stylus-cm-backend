import { IsString, IsNotEmpty, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class SuggestedBidsByAddressParamsDto {
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a valid Ethereum address',
  })
  address: string;
}

export class SuggestedBidsQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  blockchainId: string;
}
