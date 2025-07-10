import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { USER_CONTRACT_DEFAULTS } from '../constants';

/**
 * DTO for updating a user contract name
 */
export class UpdateUserContractNameDto {
  /**
   * New name for the user contract
   * @example "My Updated Contract Name"
   */
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
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
  name: string;
}
