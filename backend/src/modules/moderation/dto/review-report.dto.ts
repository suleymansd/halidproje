import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsIn(['resolved', 'dismissed'])
  status!: 'resolved' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
