import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'inappropriate_content',
  'copyright',
  'misinformation',
  'other',
] as const;

export class ReportMessageDto {
  @IsString()
  @IsIn(REPORT_REASONS)
  @MaxLength(64)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
