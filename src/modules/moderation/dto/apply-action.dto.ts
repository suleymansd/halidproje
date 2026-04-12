import { IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ApplyActionDto {
  @IsUUID()
  caseId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsString()
  @MaxLength(64)
  actionType!: string;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
