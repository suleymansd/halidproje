import { IsUUID } from 'class-validator';

export class CreateFriendRequestDto {
  @IsUUID()
  recipientId!: string;
}
