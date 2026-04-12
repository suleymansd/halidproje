export class CreateMaterialDto {
  title!: string;
  description?: string;
  courseId?: string;
  departmentId?: string;
  materialType!: string;
}
