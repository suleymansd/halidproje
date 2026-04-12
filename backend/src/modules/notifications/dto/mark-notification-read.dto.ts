import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkNotificationReadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  correlationId?: string;
}
