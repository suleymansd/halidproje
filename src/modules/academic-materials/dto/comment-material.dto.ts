import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CommentMaterialDto {
  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
