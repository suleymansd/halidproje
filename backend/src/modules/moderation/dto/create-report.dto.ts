import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsIn(['message', 'material', 'user'])
  referenceType!: 'message' | 'material' | 'user';

  @IsUUID()
  referenceId!: string;

  @IsString()
  @MaxLength(64)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
