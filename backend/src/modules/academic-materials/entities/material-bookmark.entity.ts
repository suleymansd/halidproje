export class MaterialBookmarkEntity {
  id!: string;
  materialId!: string;
  schoolId!: string;
  userId!: string;
  note?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
