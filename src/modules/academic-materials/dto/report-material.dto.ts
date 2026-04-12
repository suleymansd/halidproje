import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportMaterialDto {
  @IsString()
  @MaxLength(64)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
