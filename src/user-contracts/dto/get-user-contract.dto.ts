import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetUserContractDto {
  @ApiProperty({ description: 'User contract UUID' })
  @IsUUID(4, { message: 'id must be a valid UUID v4' })
  @IsNotEmpty({ message: 'id cannot be empty' })
  id: string;
}
