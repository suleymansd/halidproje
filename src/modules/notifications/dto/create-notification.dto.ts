import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  schoolId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  @MaxLength(64)
  type!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
