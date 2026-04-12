import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListUserRoomsDto {
  @IsOptional()
  @IsIn(['all', 'general', 'department', 'private', 'group'])
  roomType?: 'all' | 'general' | 'department' | 'private' | 'group';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
