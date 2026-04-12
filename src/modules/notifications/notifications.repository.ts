import { Injectable } from '@nestjs/common';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsRepository {
  async findNotifications(
    schoolId: string,
    userId: string,
    query: ListNotificationsDto,
  ): Promise<unknown[]> {
    void schoolId;
    void userId;
    void query;
    // TODO: Implement newest-first cursor pagination with unread and type filters.
    return [];
  }

  async countUnreadNotifications(
    schoolId: string,
    userId: string,
  ): Promise<{ unreadCount: number }> {
    void schoolId;
    void userId;
    // TODO: Query unread count for the tenant-scoped notification feed.
    return { unreadCount: 0 };
  }

  async findNotificationById(
    schoolId: string,
    userId: string,
    notificationId: string,
  ): Promise<{ id: string; schoolId: string; userId: string; isRead: boolean } | null> {
    void schoolId;
    void userId;
    void notificationId;
    // TODO: Load a single notification by id under tenant and owner scope.
    return null;
  }

  async markNotificationAsRead(
    schoolId: string,
    userId: string,
    notificationId: string,
    dto: MarkNotificationReadDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void userId;
    void notificationId;
    void dto;
    // TODO: Update is_read and read_at for the selected notification.
    return {};
  }

  async markAllNotificationsAsRead(
    schoolId: string,
    userId: string,
    dto: MarkAllNotificationsReadDto,
  ): Promise<{ updatedCount: number }> {
    void schoolId;
    void userId;
    void dto;
    // TODO: Bulk mark unread notifications as read for the user.
    return { updatedCount: 0 };
  }

  async findNotificationPreferences(
    schoolId: string,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    void schoolId;
    void userId;
    // TODO: Load or derive default notification preferences.
    return null;
  }

  async upsertNotificationPreferences(
    schoolId: string,
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void userId;
    void dto;
    // TODO: Upsert notification preferences for the user.
    return {};
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<Record<string, unknown>> {
    void dto;
    // TODO: Insert a single in-app notification row.
    return {};
  }

  async createBulkNotifications(
    dtos: CreateNotificationDto[],
  ): Promise<Record<string, unknown>[]> {
    void dtos;
    // TODO: Bulk insert notification rows transactionally where appropriate.
    return [];
  }
}
