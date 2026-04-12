import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true ? true : value === 'false' || value === false ? false : value,
  )
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsIn([
    'friend_request_received',
    'friend_request_accepted',
    'new_direct_message',
    'group_invite',
    'material_comment',
    'material_vote',
    'report_status_update',
    'system_notice',
  ])
  type?: string;
}
