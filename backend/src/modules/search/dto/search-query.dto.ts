import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof obj?.q === 'string' && obj.q.trim().length > 0) {
      return obj.q.trim();
    }
    return '';
  })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsIn(['material', 'user', 'group'])
  entityType?: 'material' | 'user' | 'group';

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
