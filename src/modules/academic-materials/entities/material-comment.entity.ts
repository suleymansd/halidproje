export class MaterialCommentEntity {
  id!: string;
  materialId!: string;
  schoolId!: string;
  userId!: string;
  parentCommentId?: string | null;
  content!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
