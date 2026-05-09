import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsRepository {
  private schemaReady = false;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findNotifications(
    schoolId: string,
    userId: string,
    query: ListNotificationsDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    await this.ensureSchema();

    const params: Array<string | number | boolean> = [schoolId, userId];
    const where: string[] = ['school_id = $1', 'user_id = $2'];

    if (query.unreadOnly === true) {
      where.push('is_read = false');
    }

    if (query.type) {
      params.push(query.type);
      where.push(`type = $${params.length}`);
    }

    params.push(query.limit);
    const limitParam = `$${params.length}`;

    const result = await this.pool.query(
      `
        SELECT
          id,
          school_id,
          user_id,
          type,
          title,
          body,
          is_read,
          created_at,
          read_at,
          reference_type,
          reference_id,
          metadata
        FROM notifications
        WHERE ${where.join('\n          AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitParam}
      `,
      params,
    );

    return {
      items: result.rows.map((row) => this.mapNotificationRow(row)),
      nextCursor: null,
    };
  }

  async countUnreadNotifications(
    schoolId: string,
    userId: string,
  ): Promise<{ unreadCount: number }> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM notifications
        WHERE school_id = $1
          AND user_id = $2
          AND is_read = false
      `,
      [schoolId, userId],
    );

    return { unreadCount: Number(result.rows[0]?.unread_count ?? 0) };
  }

  async findNotificationById(
    schoolId: string,
    userId: string,
    notificationId: string,
  ): Promise<{ id: string; schoolId: string; userId: string; isRead: boolean } | null> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT id, school_id, user_id, is_read
        FROM notifications
        WHERE school_id = $1
          AND user_id = $2
          AND id = $3
        LIMIT 1
      `,
      [schoolId, userId, notificationId],
    );

    if (!result.rowCount) {
      return null;
    }

    return {
      id: result.rows[0].id,
      schoolId: result.rows[0].school_id,
      userId: result.rows[0].user_id,
      isRead: result.rows[0].is_read,
    };
  }

  async markNotificationAsRead(
    schoolId: string,
    userId: string,
    notificationId: string,
    dto: MarkNotificationReadDto,
  ): Promise<Record<string, unknown>> {
    void dto;
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        UPDATE notifications
        SET
          is_read = true,
          read_at = COALESCE(read_at, now()),
          updated_at = now()
        WHERE school_id = $1
          AND user_id = $2
          AND id = $3
        RETURNING
          id,
          school_id,
          user_id,
          type,
          title,
          body,
          is_read,
          created_at,
          read_at,
          reference_type,
          reference_id,
          metadata
      `,
      [schoolId, userId, notificationId],
    );

    return result.rowCount ? this.mapNotificationRow(result.rows[0]) : {};
  }

  async markAllNotificationsAsRead(
    schoolId: string,
    userId: string,
    dto: MarkAllNotificationsReadDto,
  ): Promise<{ updatedCount: number }> {
    void dto;
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        UPDATE notifications
        SET
          is_read = true,
          read_at = COALESCE(read_at, now()),
          updated_at = now()
        WHERE school_id = $1
          AND user_id = $2
          AND is_read = false
      `,
      [schoolId, userId],
    );

    return { updatedCount: result.rowCount ?? 0 };
  }

  async findNotificationPreferences(
    schoolId: string,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT
          school_id,
          user_id,
          message_notifications_enabled,
          social_notifications_enabled,
          material_notifications_enabled,
          system_notifications_enabled,
          updated_at
        FROM notification_preferences
        WHERE school_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [schoolId, userId],
    );

    if (!result.rowCount) {
      return {
        schoolId,
        userId,
        messageNotificationsEnabled: true,
        socialNotificationsEnabled: true,
        materialNotificationsEnabled: true,
        systemNotificationsEnabled: true,
      };
    }

    return {
      schoolId: result.rows[0].school_id,
      userId: result.rows[0].user_id,
      messageNotificationsEnabled: result.rows[0].message_notifications_enabled,
      socialNotificationsEnabled: result.rows[0].social_notifications_enabled,
      materialNotificationsEnabled: result.rows[0].material_notifications_enabled,
      systemNotificationsEnabled: result.rows[0].system_notifications_enabled,
      updatedAt: result.rows[0].updated_at,
    };
  }

  async upsertNotificationPreferences(
    schoolId: string,
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<Record<string, unknown>> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        INSERT INTO notification_preferences (
          school_id,
          user_id,
          message_notifications_enabled,
          social_notifications_enabled,
          material_notifications_enabled,
          system_notifications_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (school_id, user_id)
        DO UPDATE SET
          message_notifications_enabled = EXCLUDED.message_notifications_enabled,
          social_notifications_enabled = EXCLUDED.social_notifications_enabled,
          material_notifications_enabled = EXCLUDED.material_notifications_enabled,
          system_notifications_enabled = EXCLUDED.system_notifications_enabled,
          updated_at = now()
        RETURNING
          school_id,
          user_id,
          message_notifications_enabled,
          social_notifications_enabled,
          material_notifications_enabled,
          system_notifications_enabled,
          updated_at
      `,
      [
        schoolId,
        userId,
        dto.messageNotificationsEnabled ?? true,
        dto.socialNotificationsEnabled ?? true,
        dto.materialNotificationsEnabled ?? true,
        dto.systemNotificationsEnabled ?? true,
      ],
    );

    return {
      schoolId: result.rows[0].school_id,
      userId: result.rows[0].user_id,
      messageNotificationsEnabled: result.rows[0].message_notifications_enabled,
      socialNotificationsEnabled: result.rows[0].social_notifications_enabled,
      materialNotificationsEnabled: result.rows[0].material_notifications_enabled,
      systemNotificationsEnabled: result.rows[0].system_notifications_enabled,
      updatedAt: result.rows[0].updated_at,
    };
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<Record<string, unknown>> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        INSERT INTO notifications (
          school_id,
          user_id,
          type,
          title,
          body,
          reference_type,
          reference_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING
          id,
          school_id,
          user_id,
          type,
          title,
          body,
          is_read,
          created_at,
          read_at,
          reference_type,
          reference_id,
          metadata
      `,
      [
        dto.schoolId,
        dto.userId,
        dto.type,
        dto.title,
        dto.body,
        dto.referenceType ?? null,
        dto.referenceId ?? null,
        JSON.stringify(dto.metadata ?? {}),
      ],
    );

    return this.mapNotificationRow(result.rows[0]);
  }

  async createBulkNotifications(
    dtos: CreateNotificationDto[],
  ): Promise<Record<string, unknown>[]> {
    if (dtos.length === 0) {
      return [];
    }

    const created: Record<string, unknown>[] = [];
    for (const dto of dtos) {
      created.push(await this.createNotification(dto));
    }

    return created;
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type varchar(64) NOT NULL,
        title varchar(200) NOT NULL,
        body varchar(1000) NOT NULL,
        is_read boolean NOT NULL DEFAULT false,
        read_at timestamptz NULL,
        reference_type varchar(64) NULL,
        reference_id uuid NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
        ON notifications (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications (user_id, is_read);

      CREATE TABLE IF NOT EXISTS notification_preferences (
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_notifications_enabled boolean NOT NULL DEFAULT true,
        social_notifications_enabled boolean NOT NULL DEFAULT true,
        material_notifications_enabled boolean NOT NULL DEFAULT true,
        system_notifications_enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (school_id, user_id)
      );
    `);

    this.schemaReady = true;
  }

  private mapNotificationRow(row: Record<string, any>): Record<string, unknown> {
    return {
      id: row.id,
      schoolId: row.school_id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      content: row.body,
      isRead: row.is_read,
      createdAt: row.created_at,
      readAt: row.read_at,
      relatedId: row.reference_id,
      referenceType: row.reference_type,
      metadata: row.metadata ?? {},
    };
  }
}
