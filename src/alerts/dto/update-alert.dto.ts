import { IsOptional, IsString, IsBoolean, ValidateIf } from 'class-validator';

export class UpdateAlertDto {
  @IsOptional()
  @ValidateIf((o: UpdateAlertDto) => o.value !== undefined)
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  emailChannelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  slackChannelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  telegramChannelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookChannelEnabled?: boolean;
}
