import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class PollingConfigDto {
  @IsOptional()
  @IsString()
  pollingInterval?: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  contractTimeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetryAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  retryDelay?: number;

  @IsOptional()
  @IsBoolean()
  enableMetrics?: boolean;

  @IsOptional()
  @IsBoolean()
  enableInitialPolling?: boolean;
}
