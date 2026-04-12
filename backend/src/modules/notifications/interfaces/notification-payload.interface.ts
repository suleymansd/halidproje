import { NotificationReference } from './notification-reference.interface';

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  reference?: NotificationReference;
  metadata?: Record<string, unknown>;
}
