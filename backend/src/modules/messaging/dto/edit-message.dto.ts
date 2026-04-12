import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class EditMessageDto {
  @IsUUID()
  messageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}
