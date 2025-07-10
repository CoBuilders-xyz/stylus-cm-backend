import { IsUUID, IsNotEmpty } from 'class-validator';

export class GetAlertDto {
  @IsUUID()
  @IsNotEmpty()
  alertId: string;
}
