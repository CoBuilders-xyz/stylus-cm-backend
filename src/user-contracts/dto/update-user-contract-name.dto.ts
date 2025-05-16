import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserContractNameDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
