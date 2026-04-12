export class ModerationActionEntity {
  id!: string;
  schoolId!: string;
  caseId!: string;
  targetUserId!: string;
  actionType!: string;
  reason!: string;
  durationSeconds?: number | null;
  createdBy!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
