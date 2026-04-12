import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListReportsDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['message', 'material', 'user'])
  referenceType?: string;

  @IsOptional()
  @IsIn(['open', 'under_review', 'linked', 'resolved', 'dismissed'])
  status?: string;
}
