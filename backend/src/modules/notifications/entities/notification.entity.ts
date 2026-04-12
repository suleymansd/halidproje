export class NotificationEntity {
  id!: string;
  schoolId!: string;
  userId!: string;
  type!: string;
  title!: string;
  body!: string;
  referenceType?: string | null;
  referenceId?: string | null;
  isRead!: boolean;
  readAt?: Date | null;
  metadata!: Record<string, unknown>;
  createdAt!: Date;
  updatedAt!: Date;
}
