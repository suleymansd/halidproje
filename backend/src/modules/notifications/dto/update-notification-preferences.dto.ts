import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  messageNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  socialNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  materialNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  systemNotificationsEnabled?: boolean;
}
