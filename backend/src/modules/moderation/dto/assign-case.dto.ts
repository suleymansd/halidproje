import { IsUUID } from 'class-validator';

export class AssignCaseDto {
  @IsUUID()
  assignedModeratorId!: string;
}
