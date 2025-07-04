import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * DTO for getting a single user contract by ID
 */
export class GetUserContractDto {
  /**
   * Unique identifier of the user contract
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  @IsUUID(4, { message: 'id must be a valid UUID v4' })
  @IsNotEmpty({ message: 'id cannot be empty' })
  id: string;
}
