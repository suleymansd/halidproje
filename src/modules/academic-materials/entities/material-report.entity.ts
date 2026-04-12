export class MaterialReportEntity {
  id!: string;
  materialId!: string;
  schoolId!: string;
  reporterId!: string;
  reason!: string;
  description?: string | null;
  status!: string;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
