import { IsUUID } from 'class-validator';

export class CreatePrivateRoomDto {
  @IsUUID()
  targetUserId!: string;
}
