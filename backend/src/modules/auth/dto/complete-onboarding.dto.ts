import { Allow, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CompleteOnboardingDto {
  @Allow()
  fullName?: string;

  @Allow()
  schoolId?: string;

  @Allow()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_name?: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsUUID()
  department_id!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,30}$/)
  username?: string;
}
