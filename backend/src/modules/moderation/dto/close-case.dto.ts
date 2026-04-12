import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseCaseDto {
  @IsIn(['closed', 'dismissed'])
  status!: 'closed' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
