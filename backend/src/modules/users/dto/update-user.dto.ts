import { Allow, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class UpdateUserDto {
  @Allow()
  fullName?: string;

  @Allow()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_name?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,30}$/)
  username?: string;
}
