import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BookmarkMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}
