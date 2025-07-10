import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsUUID,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { USER_CONTRACT_DEFAULTS } from '../constants';

/**
 * DTO for creating a new user contract
 */
export class CreateUserContractDto {
  /**
   * Ethereum contract address (must be a valid hex address starting with 0x)
   * @example "0x1234567890abcdef1234567890abcdef12345678"
   */
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address cannot be empty' })
  @Matches(USER_CONTRACT_DEFAULTS.VALIDATION.ADDRESS_REGEX, {
    message:
      'Address must be a valid Ethereum address starting with 0x followed by 40 hex characters',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  address: string;

  /**
   * ID of the blockchain where the contract is deployed
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  @IsString({ message: 'BlockchainId must be a string' })
  @IsNotEmpty({ message: 'BlockchainId cannot be empty' })
  @IsUUID(4, { message: 'BlockchainId must be a valid UUID v4' })
  blockchainId: string;

  /**
   * Optional custom name for the contract (defaults to address if not provided)
   * @example "My DeFi Contract"
   */
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(
    USER_CONTRACT_DEFAULTS.VALIDATION.MIN_NAME_LENGTH,
    USER_CONTRACT_DEFAULTS.VALIDATION.MAX_NAME_LENGTH,
    {
      message: `Name must be between ${USER_CONTRACT_DEFAULTS.VALIDATION.MIN_NAME_LENGTH} and ${USER_CONTRACT_DEFAULTS.VALIDATION.MAX_NAME_LENGTH} characters`,
    },
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;
}
