import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class GetUserContractDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;
}
