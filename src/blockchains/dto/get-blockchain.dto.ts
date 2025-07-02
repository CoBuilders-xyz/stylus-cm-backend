import { IsUUID, IsNotEmpty } from 'class-validator';

export class GetBlockchainDto {
  @IsUUID()
  @IsNotEmpty()
  blockchainId: string;
}
