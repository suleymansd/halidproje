import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkAllNotificationsReadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  correlationId?: string;
}
