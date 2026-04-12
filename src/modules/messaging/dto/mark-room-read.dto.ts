import { IsUUID } from 'class-validator';

export class MarkRoomAsReadDto {
  @IsUUID()
  roomId!: string;

  @IsUUID()
  lastReadMessageId!: string;
}
