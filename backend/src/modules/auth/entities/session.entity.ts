export class SessionEntity {
  id!: string;
  userId!: string;
  schoolId!: string;
  refreshTokenHash!: string;
  expiresAt!: Date;
  revokedAt!: Date | null;
}
