export class ModerationCaseEntity {
  id!: string;
  schoolId!: string;
  createdBy!: string;
  assignedModeratorId?: string | null;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
