import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportMessageDto {
  @IsString()
  @MaxLength(64)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
