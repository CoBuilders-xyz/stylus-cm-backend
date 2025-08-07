import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUrl,
  IsEthereumAddress,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateBlockchainDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsNotEmpty()
  rpcUrl: string;

  @IsUrl()
  @IsNotEmpty()
  fastSyncRpcUrl: string;

  @IsUrl()
  @IsNotEmpty()
  rpcWssUrl: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  cacheManagerAddress: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  arbWasmCacheAddress: string;

  @IsEthereumAddress()
  @IsNotEmpty()
  arbWasmAddress: string;

  @IsNumber()
  @IsNotEmpty()
  chainId: number;

  @IsOptional()
  @IsUrl()
  rpcUrlBackup?: string;

  @IsOptional()
  @IsUrl()
  rpcWssUrlBackup?: string;

  @IsOptional()
  @IsEthereumAddress()
  cacheManagerAutomationAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originBlock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lastSyncedBlock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lastProcessedBlockNumber?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
