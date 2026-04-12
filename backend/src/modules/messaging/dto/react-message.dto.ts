import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @IsUUID()
  messageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  reaction!: string;
}
