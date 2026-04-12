import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCaseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  reportIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
