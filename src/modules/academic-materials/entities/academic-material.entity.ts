export class AcademicMaterialEntity {
  id!: string;
  schoolId!: string;
  uploaderId!: string;
  courseId?: string | null;
  departmentId?: string | null;
  title!: string;
  description?: string | null;
  materialType!: string;
  voteCount!: number;
  commentCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
