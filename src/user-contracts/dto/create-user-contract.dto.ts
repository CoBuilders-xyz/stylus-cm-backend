import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsUUID,
  Length,
} from 'class-validator';
import { USER_CONTRACT_DEFAULTS } from '../constants';

export class CreateUserContractDto {
  @IsString()
  @IsNotEmpty()
  @Matches(USER_CONTRACT_DEFAULTS.VALIDATION.ADDRESS_REGEX, {
    message: 'Address must be a valid Ethereum address starting with 0x',
  })
  address: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'blockchainId must be a valid UUID' })
  blockchainId: string;

  @IsOptional()
  @IsString()
  @Length(
    USER_CONTRACT_DEFAULTS.VALIDATION.MIN_NAME_LENGTH,
    USER_CONTRACT_DEFAULTS.VALIDATION.MAX_NAME_LENGTH,
    { message: 'Name must be between 1 and 255 characters' },
  )
  name?: string;
}
