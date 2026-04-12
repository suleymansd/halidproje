import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UploadMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  materialType!: string;

  @IsString()
  @IsNotEmpty()
  storageUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fileType!: string;

  @Matches(/^\d+$/)
  fileSize!: string;
}
