export class AuditLogEntity {
  id!: string;
  schoolId?: string;
  actorUserId?: string;
  action!: string;
  createdAt!: Date;
}
