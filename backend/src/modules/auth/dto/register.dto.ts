import {
  Allow,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Allow()
  fullName?: string;

  @Allow()
  schoolId?: string;

  @Allow()
  departmentId?: string;

  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsEmail()
  @Matches(/@isu\.edu\.tr$/i, {
    message: 'Email must use the @isu.edu.tr domain',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsUUID()
  school_id!: string;

  @IsUUID()
  department_id!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._]{3,30}$/)
  username?: string;
}
