export class ReportEntity {
  id!: string;
  schoolId!: string;
  reporterId!: string;
  referenceType!: string;
  referenceId!: string;
  reason!: string;
  description?: string | null;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
