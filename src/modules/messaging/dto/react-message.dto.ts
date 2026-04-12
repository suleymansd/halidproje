import { IsString, IsUUID, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @IsUUID()
  messageId!: string;

  @IsString()
  @MaxLength(32)
  reaction!: string;
}
