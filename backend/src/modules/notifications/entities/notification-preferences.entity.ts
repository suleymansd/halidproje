export class NotificationPreferencesEntity {
  id!: string;
  schoolId!: string;
  userId!: string;
  messageNotificationsEnabled!: boolean;
  socialNotificationsEnabled!: boolean;
  materialNotificationsEnabled!: boolean;
  systemNotificationsEnabled!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
