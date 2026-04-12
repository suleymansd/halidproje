import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPayload } from './interfaces/notification-payload.interface';
import { NotificationsRepository } from './notifications.repository';
import { NotificationAccessPolicy } from './policies/notification-access.policy';

interface NotificationUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationAccessPolicy: NotificationAccessPolicy,
  ) {}

  async listNotifications(
    user: NotificationUserContext,
    query: ListNotificationsDto,
  ) {
    return this.notificationsRepository.findNotifications(
      user.schoolId,
      user.id,
      query,
    );
  }

  async getUnreadCount(user: NotificationUserContext) {
    return this.notificationsRepository.countUnreadNotifications(
      user.schoolId,
      user.id,
    );
  }

  async markAsRead(
    user: NotificationUserContext,
    notificationId: string,
    dto: MarkNotificationReadDto,
  ) {
    const notification = await this.notificationsRepository.findNotificationById(
      user.schoolId,
      user.id,
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    this.notificationAccessPolicy.assertOwnNotification(user.id, notification.userId);

    return this.notificationsRepository.markNotificationAsRead(
      user.schoolId,
      user.id,
      notificationId,
      dto,
    );
  }

  async markAllAsRead(
    user: NotificationUserContext,
    dto: MarkAllNotificationsReadDto,
  ) {
    return this.notificationsRepository.markAllNotificationsAsRead(
      user.schoolId,
      user.id,
      dto,
    );
  }

  async getPreferences(user: NotificationUserContext) {
    return this.notificationsRepository.findNotificationPreferences(
      user.schoolId,
      user.id,
    );
  }

  async updatePreferences(
    user: NotificationUserContext,
    dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsRepository.upsertNotificationPreferences(
      user.schoolId,
      user.id,
      dto,
    );
  }

  async createNotification(dto: CreateNotificationDto) {
    return this.notificationsRepository.createNotification(dto);
  }

  async createBulkNotifications(dtos: CreateNotificationDto[]) {
    return this.notificationsRepository.createBulkNotifications(dtos);
  }

  async createNotificationFromPayload(
    schoolId: string,
    userId: string,
    payload: NotificationPayload,
  ) {
    return this.notificationsRepository.createNotification({
      schoolId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      referenceType: payload.reference?.referenceType,
      referenceId: payload.reference?.referenceId,
      metadata: payload.metadata,
    });
  }
}
