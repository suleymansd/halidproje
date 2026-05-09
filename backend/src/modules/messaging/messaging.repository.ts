import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { ListRoomMessagesDto } from './dto/list-room-messages.dto';
import { ListUserRoomsDto } from './dto/list-user-rooms.dto';

interface CreateMessageParams {
  roomId: string;
  senderId: string;
  body: string;
  replyToMessageId?: string;
  attachmentIds: string[];
}

interface UpdateMessageParams {
  body: string;
  editorId: string;
}

interface ReactionParams {
  messageId: string;
  userId: string;
  reaction: string;
}

interface MarkReadStateParams {
  roomId: string;
  userId: string;
  lastReadMessageId: string;
}

interface CreateMessageReportParams {
  messageId: string;
  reporterId: string;
  reason: string;
  description?: string;
}

@Injectable()
export class MessagingRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findUserRooms(
    schoolId: string,
    userId: string,
    query: ListUserRoomsDto,
  ): Promise<unknown[]> {
    const roomType = query.roomType ?? 'all';
    const result = await this.pool.query(
      `
        WITH cu AS (
          SELECT id, school_id, department_id
          FROM users
          WHERE id = $2 AND school_id = $1
          LIMIT 1
        )
        SELECT
          r.id,
          r.school_id,
          r.room_type,
          r.department_id,
          r.group_id,
          r.name,
          r.description,
          r.avatar_url,
          member.room_role,
          member.joined_at,
          read_state.last_read_message_id,
          read_state.last_read_at,
          counterpart.id AS counterpart_id,
          counterpart.email AS counterpart_email,
          counterpart.full_name AS counterpart_full_name,
          counterpart.username AS counterpart_username,
          counterpart.role AS counterpart_role,
          counterpart.department_id AS counterpart_department_id,
          last_message.id AS last_message_id,
          last_message.sender_id AS last_message_sender_id,
          last_message.message_type AS last_message_type,
          last_message.content AS last_message_content,
          last_message.reply_to_message_id AS last_message_reply_to_message_id,
          last_message.is_edited AS last_message_is_edited,
          last_message.edited_at AS last_message_edited_at,
          last_message.is_deleted AS last_message_is_deleted,
          last_message.deleted_at AS last_message_deleted_at,
          last_message.created_at AS last_message_created_at,
          last_message.updated_at AS last_message_updated_at,
          last_sender.full_name AS last_message_sender_full_name,
          last_sender.username AS last_message_sender_username,
          last_sender.role AS last_message_sender_role,
          COALESCE(unread.unread_count, 0) AS unread_count
        FROM cu
        INNER JOIN chat_rooms r
          ON r.school_id = cu.school_id
         AND r.is_active = true
         AND r.is_archived = false
        LEFT JOIN chat_room_members member
          ON member.room_id = r.id
         AND member.user_id = cu.id
         AND member.school_id = cu.school_id
         AND member.is_active = true
         AND member.left_at IS NULL
        LEFT JOIN message_read_states read_state
          ON read_state.room_id = r.id
         AND read_state.user_id = cu.id
         AND read_state.school_id = cu.school_id
        LEFT JOIN users counterpart
          ON r.room_type = 'private'
         AND counterpart.id = CASE
           WHEN r.dm_user_low_id = cu.id THEN r.dm_user_high_id
           ELSE r.dm_user_low_id
         END
        LEFT JOIN LATERAL (
          SELECT
            m.id,
            m.sender_id,
            m.message_type,
            m.content,
            m.reply_to_message_id,
            m.is_edited,
            m.edited_at,
            m.is_deleted,
            m.deleted_at,
            m.created_at,
            m.updated_at
          FROM messages m
          WHERE m.school_id = cu.school_id
            AND m.room_id = r.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) last_message ON true
        LEFT JOIN users last_sender
          ON last_sender.id = last_message.sender_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS unread_count
          FROM messages m
          WHERE m.school_id = cu.school_id
            AND m.room_id = r.id
            AND (
              read_state.last_read_at IS NULL
              OR m.created_at > read_state.last_read_at
            )
        ) unread ON true
        WHERE (
          r.room_type = 'general'
          OR (r.room_type = 'department' AND r.department_id = cu.department_id)
          OR (r.room_type IN ('private', 'group') AND member.user_id IS NOT NULL)
        )
          AND ($3 = 'all' OR r.room_type = $3::chat_room_type)
        ORDER BY COALESCE(last_message.created_at, r.created_at) DESC, r.id DESC
        LIMIT $4
      `,
      [schoolId, userId, roomType, query.limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      roomType: row.room_type,
      departmentId: row.department_id,
      groupId: row.group_id,
      name: row.name,
      description: row.description,
      avatarUrl: row.avatar_url,
      membershipRole: row.room_role,
      joinedAt: this.toIso(row.joined_at),
      lastReadMessageId: row.last_read_message_id,
      lastReadAt: this.toIso(row.last_read_at),
      counterpartUser: row.counterpart_id
        ? {
            id: row.counterpart_id,
            email: row.counterpart_email,
            fullName: row.counterpart_full_name,
            username: row.counterpart_username,
            role: row.counterpart_role,
            departmentId: row.counterpart_department_id,
          }
        : null,
      lastMessage: row.last_message_id
        ? this.mapMessageRow(
            {
              id: row.last_message_id,
              school_id: schoolId,
              room_id: row.id,
              sender_id: row.last_message_sender_id,
              message_type: row.last_message_type,
              content: row.last_message_content,
              reply_to_message_id: row.last_message_reply_to_message_id,
              is_edited: row.last_message_is_edited,
              edited_at: row.last_message_edited_at,
              is_deleted: row.last_message_is_deleted,
              deleted_at: row.last_message_deleted_at,
              created_at: row.last_message_created_at,
              updated_at: row.last_message_updated_at,
              sender_full_name: row.last_message_sender_full_name,
              sender_username: row.last_message_sender_username,
              sender_role: row.last_message_sender_role,
            },
            [],
            [],
          )
        : null,
      unreadCount: Number(row.unread_count ?? 0),
    }));
  }

  async findRoomById(
    schoolId: string,
    roomId: string,
    userId?: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT
          r.id,
          r.school_id,
          r.room_type,
          r.department_id,
          r.group_id,
          r.created_by,
          r.dm_user_low_id,
          r.dm_user_high_id,
          r.name,
          r.description,
          r.avatar_url,
          r.is_active,
          r.is_archived,
          r.archived_at,
          r.created_at,
          r.updated_at,
          member.room_role,
          member.joined_at,
          read_state.last_read_message_id,
          read_state.last_read_at,
          counterpart.id AS counterpart_id,
          counterpart.email AS counterpart_email,
          counterpart.full_name AS counterpart_full_name,
          counterpart.username AS counterpart_username,
          counterpart.role AS counterpart_role,
          counterpart.department_id AS counterpart_department_id
        FROM chat_rooms r
        LEFT JOIN chat_room_members member
          ON member.room_id = r.id
         AND member.user_id = $3
         AND member.school_id = r.school_id
         AND member.is_active = true
         AND member.left_at IS NULL
        LEFT JOIN message_read_states read_state
          ON read_state.room_id = r.id
         AND read_state.user_id = $3
         AND read_state.school_id = r.school_id
        LEFT JOIN users counterpart
          ON r.room_type = 'private'
         AND counterpart.id = CASE
           WHEN r.dm_user_low_id = $3 THEN r.dm_user_high_id
           ELSE r.dm_user_low_id
         END
        WHERE r.school_id = $1
          AND r.id = $2
          AND r.is_active = true
        LIMIT 1
      `,
      [schoolId, roomId, userId ?? null],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      schoolId: row.school_id,
      roomType: row.room_type,
      departmentId: row.department_id,
      groupId: row.group_id,
      createdBy: row.created_by,
      dmUserLowId: row.dm_user_low_id,
      dmUserHighId: row.dm_user_high_id,
      name: row.name,
      description: row.description,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      isArchived: row.is_archived,
      archivedAt: this.toIso(row.archived_at),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
      membershipRole: row.room_role,
      joinedAt: this.toIso(row.joined_at),
      lastReadMessageId: row.last_read_message_id,
      lastReadAt: this.toIso(row.last_read_at),
      counterpartUser: row.counterpart_id
        ? {
            id: row.counterpart_id,
            email: row.counterpart_email,
            fullName: row.counterpart_full_name,
            username: row.counterpart_username,
            role: row.counterpart_role,
            departmentId: row.counterpart_department_id,
          }
        : null,
    };
  }

  async findRoomMembership(
    schoolId: string,
    roomId: string,
    userId: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT room_id, user_id, room_role, joined_at, left_at
        FROM chat_room_members
        WHERE school_id = $1
          AND room_id = $2
          AND user_id = $3
          AND is_active = true
          AND left_at IS NULL
        LIMIT 1
      `,
      [schoolId, roomId, userId],
    );

    return result.rowCount
      ? {
          roomId: result.rows[0].room_id,
          userId: result.rows[0].user_id,
          roomRole: result.rows[0].room_role,
          joinedAt: this.toIso(result.rows[0].joined_at),
          leftAt: this.toIso(result.rows[0].left_at),
        }
      : null;
  }

  async findPrivateRoomBetweenUsers(
    schoolId: string,
    userOneId: string,
    userTwoId: string,
  ): Promise<any | null> {
    const [dmUserLowId, dmUserHighId] = [userOneId, userTwoId].sort((left, right) =>
      left.localeCompare(right),
    );
    const result = await this.pool.query(
      `
        SELECT id
        FROM chat_rooms
        WHERE school_id = $1
          AND room_type = 'private'
          AND dm_user_low_id = $2
          AND dm_user_high_id = $3
          AND is_active = true
          AND is_archived = false
        LIMIT 1
      `,
      [schoolId, dmUserLowId, dmUserHighId],
    );

    return result.rowCount
      ? this.findRoomById(schoolId, result.rows[0].id, userOneId)
      : null;
  }

  async findUserById(
    schoolId: string,
    userId: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT id, school_id, department_id, email, full_name, username, role
        FROM users
        WHERE id = $1 AND school_id = $2
        LIMIT 1
      `,
      [userId, schoolId],
    );

    return result.rowCount
      ? {
          id: result.rows[0].id,
          schoolId: result.rows[0].school_id,
          departmentId: result.rows[0].department_id,
          email: result.rows[0].email,
          fullName: result.rows[0].full_name,
          username: result.rows[0].username,
          role: result.rows[0].role,
        }
      : null;
  }

  async createPrivateRoom(
    schoolId: string,
    creatorUserId: string,
    targetUserId: string,
  ): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const [dmUserLowId, dmUserHighId] = [creatorUserId, targetUserId].sort((left, right) =>
        left.localeCompare(right),
      );
      const existing = await client.query(
        `
          SELECT id
          FROM chat_rooms
          WHERE school_id = $1
            AND room_type = 'private'
            AND dm_user_low_id = $2
            AND dm_user_high_id = $3
            AND is_archived = false
          LIMIT 1
        `,
        [schoolId, dmUserLowId, dmUserHighId],
      );

      let roomId = existing.rows[0]?.id as string | undefined;
      if (!roomId) {
        const roomResult = await client.query(
          `
            INSERT INTO chat_rooms (
              school_id,
              room_type,
              created_by,
              dm_user_low_id,
              dm_user_high_id
            )
            VALUES ($1, 'private', $2, $3, $4)
            RETURNING id
          `,
          [schoolId, creatorUserId, dmUserLowId, dmUserHighId],
        );
        roomId = roomResult.rows[0].id;
      }

      await this.addRoomMemberWithClient(client, schoolId, roomId, creatorUserId);
      await this.addRoomMemberWithClient(client, schoolId, roomId, targetUserId);
      await client.query('COMMIT');
      return (await this.findRoomById(schoolId, roomId, creatorUserId)) ?? {};
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addRoomMember(
    schoolId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    await this.addRoomMemberWithClient(this.pool, schoolId, roomId, userId);
  }

  async createMessage(
    schoolId: string,
    params: CreateMessageParams,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        INSERT INTO messages (
          school_id,
          room_id,
          sender_id,
          message_type,
          content,
          reply_to_message_id
        )
        VALUES ($1, $2, $3, 'text', $4, $5)
        RETURNING id
      `,
      [
        schoolId,
        params.roomId,
        params.senderId,
        params.body,
        params.replyToMessageId ?? null,
      ],
    );

    return this.getMessageByIdOrThrow(schoolId, result.rows[0].id, params.senderId);
  }

  async updateMessage(
    schoolId: string,
    messageId: string,
    params: UpdateMessageParams,
  ): Promise<any> {
    await this.pool.query(
      `
        UPDATE messages
        SET content = $3, is_edited = true, edited_at = now(), updated_at = now()
        WHERE school_id = $1 AND id = $2
      `,
      [schoolId, messageId, params.body],
    );

    return this.getMessageByIdOrThrow(schoolId, messageId, params.editorId);
  }

  async softDeleteMessage(
    schoolId: string,
    messageId: string,
    actorUserId: string,
  ): Promise<any> {
    await this.pool.query(
      `
        UPDATE messages
        SET content = '[deleted]', is_deleted = true, deleted_at = now(), updated_at = now()
        WHERE school_id = $1 AND id = $2
      `,
      [schoolId, messageId],
    );

    return this.getMessageByIdOrThrow(schoolId, messageId, actorUserId);
  }

  async findRoomMessages(
    schoolId: string,
    roomId: string,
    query: ListRoomMessagesDto,
    userId: string,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const limit = query.limit;
    const direction = query.direction ?? 'older';
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const values: Array<string | number> = [schoolId, roomId];
    let cursorClause = '';

    if (cursor) {
      values.push(cursor.createdAt, cursor.id);
      cursorClause =
        direction === 'newer'
          ? `
            AND (
              m.created_at > $3::timestamptz
              OR (m.created_at = $3::timestamptz AND m.id > $4::uuid)
            )
          `
          : `
            AND (
              m.created_at < $3::timestamptz
              OR (m.created_at = $3::timestamptz AND m.id < $4::uuid)
            )
          `;
    }

    values.push(limit + 1);
    const limitParam = cursor ? '$5' : '$3';
    const orderBy =
      direction === 'newer'
        ? 'ORDER BY m.created_at ASC, m.id ASC'
        : 'ORDER BY m.created_at DESC, m.id DESC';

    const result = await this.pool.query(
      `
        SELECT
          m.id,
          m.school_id,
          m.room_id,
          m.sender_id,
          m.message_type,
          m.content,
          m.reply_to_message_id,
          m.is_edited,
          m.edited_at,
          m.is_deleted,
          m.deleted_at,
          m.created_at,
          m.updated_at,
          sender.full_name AS sender_full_name,
          sender.username AS sender_username,
          sender.role AS sender_role
        FROM messages m
        INNER JOIN users sender ON sender.id = m.sender_id
        WHERE m.school_id = $1
          AND m.room_id = $2
          ${cursorClause}
        ${orderBy}
        LIMIT ${limitParam}
      `,
      values,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const orderedRows = direction === 'older' ? [...rows].reverse() : rows;
    const messageIds = orderedRows.map((row) => row.id);
    const [reactionsByMessageId, attachmentsByMessageId] = await Promise.all([
      this.loadReactionSummaries(messageIds, userId),
      this.loadAttachments(messageIds),
    ]);

    return {
      items: orderedRows.map((row) =>
        this.mapMessageRow(
          row,
          reactionsByMessageId.get(row.id) ?? [],
          attachmentsByMessageId.get(row.id) ?? [],
        ),
      ),
      nextCursor:
        hasMore && rows.length > 0
          ? this.encodeCursor(rows[rows.length - 1].created_at, rows[rows.length - 1].id)
          : null,
    };
  }

  async findMessageById(
    schoolId: string,
    messageId: string,
    userId: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT
          m.id,
          m.school_id,
          m.room_id,
          m.sender_id,
          m.message_type,
          m.content,
          m.reply_to_message_id,
          m.is_edited,
          m.edited_at,
          m.is_deleted,
          m.deleted_at,
          m.created_at,
          m.updated_at,
          sender.full_name AS sender_full_name,
          sender.username AS sender_username,
          sender.role AS sender_role
        FROM messages m
        INNER JOIN users sender ON sender.id = m.sender_id
        WHERE m.school_id = $1
          AND m.id = $2
        LIMIT 1
      `,
      [schoolId, messageId],
    );

    if (!result.rowCount) {
      return null;
    }

    const [reactionsByMessageId, attachmentsByMessageId] = await Promise.all([
      this.loadReactionSummaries([messageId], userId),
      this.loadAttachments([messageId]),
    ]);

    return this.mapMessageRow(
      result.rows[0],
      reactionsByMessageId.get(messageId) ?? [],
      attachmentsByMessageId.get(messageId) ?? [],
    );
  }

  async upsertReaction(
    schoolId: string,
    params: ReactionParams,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        WITH target_message AS (
          SELECT id, room_id
          FROM messages
          WHERE school_id = $1 AND id = $2
          LIMIT 1
        ),
        upserted AS (
          INSERT INTO message_reactions (school_id, message_id, user_id, reaction_type)
          SELECT $1, id, $3, $4
          FROM target_message
          ON CONFLICT (message_id, user_id, reaction_type)
          DO UPDATE SET updated_at = now()
          RETURNING message_id, user_id, reaction_type
        )
        SELECT tm.room_id, u.message_id, u.user_id, u.reaction_type
        FROM upserted u
        CROSS JOIN target_message tm
      `,
      [schoolId, params.messageId, params.userId, params.reaction],
    );

    return {
      roomId: result.rows[0].room_id,
      messageId: result.rows[0].message_id,
      userId: result.rows[0].user_id,
      reaction: result.rows[0].reaction_type,
    };
  }

  async removeReaction(
    schoolId: string,
    params: ReactionParams,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        WITH target_message AS (
          SELECT id, room_id
          FROM messages
          WHERE school_id = $1 AND id = $2
          LIMIT 1
        ),
        deleted AS (
          DELETE FROM message_reactions
          WHERE school_id = $1
            AND message_id = $2
            AND user_id = $3
            AND reaction_type = $4
          RETURNING 1
        )
        SELECT
          tm.room_id,
          $2::uuid AS message_id,
          $3::uuid AS user_id,
          $4::varchar AS reaction_type,
          EXISTS (SELECT 1 FROM deleted) AS removed
        FROM target_message tm
      `,
      [schoolId, params.messageId, params.userId, params.reaction],
    );

    return {
      roomId: result.rows[0].room_id,
      messageId: result.rows[0].message_id,
      userId: result.rows[0].user_id,
      reaction: result.rows[0].reaction_type,
      removed: result.rows[0].removed,
    };
  }

  async markReadState(
    schoolId: string,
    params: MarkReadStateParams,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        INSERT INTO message_read_states (
          school_id,
          room_id,
          user_id,
          last_read_message_id,
          last_read_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET
          last_read_message_id = EXCLUDED.last_read_message_id,
          last_read_at = now(),
          updated_at = now()
        RETURNING room_id, user_id, last_read_message_id, last_read_at
      `,
      [schoolId, params.roomId, params.userId, params.lastReadMessageId],
    );

    return {
      roomId: result.rows[0].room_id,
      userId: result.rows[0].user_id,
      lastReadMessageId: result.rows[0].last_read_message_id,
      lastReadAt: this.toIso(result.rows[0].last_read_at),
    };
  }

  async createMessageReport(
    schoolId: string,
    params: CreateMessageReportParams,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        WITH target_message AS (
          SELECT id
          FROM messages
          WHERE school_id = $1 AND id = $2
          LIMIT 1
        )
        INSERT INTO message_reports (
          school_id,
          message_id,
          reporter_id,
          reason,
          description
        )
        SELECT $1, id, $3, $4::chat_report_reason, $5
        FROM target_message
        ON CONFLICT (message_id, reporter_id)
        DO UPDATE SET
          reason = EXCLUDED.reason,
          description = EXCLUDED.description,
          status = 'open',
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_at = now()
        RETURNING id, message_id, reporter_id, reason, description, status, created_at
      `,
      [schoolId, params.messageId, params.reporterId, params.reason, params.description ?? null],
    );
    const roomResult = await this.pool.query(
      `SELECT room_id FROM messages WHERE school_id = $1 AND id = $2 LIMIT 1`,
      [schoolId, params.messageId],
    );

    return {
      id: result.rows[0].id,
      roomId: roomResult.rows[0].room_id,
      messageId: result.rows[0].message_id,
      reporterId: result.rows[0].reporter_id,
      reason: result.rows[0].reason,
      description: result.rows[0].description,
      status: result.rows[0].status,
      createdAt: this.toIso(result.rows[0].created_at),
    };
  }

  async findRoomMemberUserIds(
    schoolId: string,
    roomId: string,
  ): Promise<string[]> {
    const result = await this.pool.query(
      `
        SELECT user_id
        FROM chat_room_members
        WHERE school_id = $1
          AND room_id = $2
          AND is_active = true
          AND left_at IS NULL
      `,
      [schoolId, roomId],
    );

    return result.rows.map((row) => row.user_id as string);
  }

  private async addRoomMemberWithClient(
    client: Pool | PoolClient,
    schoolId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO chat_room_members (
          school_id,
          room_id,
          user_id,
          room_role,
          is_active,
          left_at
        )
        VALUES ($1, $2, $3, 'member', true, NULL)
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET
          is_active = true,
          left_at = NULL,
          updated_at = now()
      `,
      [schoolId, roomId, userId],
    );
  }

  private async getMessageByIdOrThrow(
    schoolId: string,
    messageId: string,
    userId: string,
  ): Promise<any> {
    const message = await this.findMessageById(schoolId, messageId, userId);
    if (!message) {
      throw new Error('Message not found after persistence');
    }

    return message;
  }

  private async loadReactionSummaries(
    messageIds: string[],
    userId: string,
  ): Promise<Map<string, unknown[]>> {
    const summaries = new Map<string, unknown[]>();
    if (messageIds.length === 0) {
      return summaries;
    }

    const result = await this.pool.query(
      `
        SELECT
          message_id,
          reaction_type,
          COUNT(*)::int AS reaction_count,
          BOOL_OR(user_id = $2) AS reacted_by_me
        FROM message_reactions
        WHERE message_id = ANY($1::uuid[])
        GROUP BY message_id, reaction_type
        ORDER BY message_id, reaction_type
      `,
      [messageIds, userId],
    );

    for (const row of result.rows) {
      const existing = summaries.get(row.message_id) ?? [];
      existing.push({
        reaction: row.reaction_type,
        count: Number(row.reaction_count),
        reactedByMe: row.reacted_by_me,
      });
      summaries.set(row.message_id, existing);
    }

    return summaries;
  }

  private async loadAttachments(
    messageIds: string[],
  ): Promise<Map<string, unknown[]>> {
    const attachments = new Map<string, unknown[]>();
    if (messageIds.length === 0) {
      return attachments;
    }

    const result = await this.pool.query(
      `
        SELECT
          id,
          message_id,
          attachment_type,
          storage_url,
          filename,
          mime_type,
          file_size_bytes,
          thumbnail_url
        FROM message_attachments
        WHERE message_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [messageIds],
    );

    for (const row of result.rows) {
      const existing = attachments.get(row.message_id) ?? [];
      existing.push({
        id: row.id,
        attachmentType: row.attachment_type,
        storageUrl: row.storage_url,
        filename: row.filename,
        mimeType: row.mime_type,
        fileSizeBytes: Number(row.file_size_bytes),
        thumbnailUrl: row.thumbnail_url,
      });
      attachments.set(row.message_id, existing);
    }

    return attachments;
  }

  private mapMessageRow(
    row: Record<string, unknown>,
    reactions: unknown[],
    attachments: unknown[],
  ): any {
    return {
      id: String(row.id),
      schoolId: String(row.school_id),
      roomId: String(row.room_id),
      senderId: String(row.sender_id),
      messageType: String(row.message_type),
      content: row.content ? String(row.content) : null,
      replyToMessageId: row.reply_to_message_id ? String(row.reply_to_message_id) : null,
      isEdited: Boolean(row.is_edited),
      editedAt: this.toIso(row.edited_at),
      isDeleted: Boolean(row.is_deleted),
      deletedAt: this.toIso(row.deleted_at),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
      sender: {
        id: String(row.sender_id),
        fullName: String(row.sender_full_name),
        username: row.sender_username ? String(row.sender_username) : null,
        role: String(row.sender_role),
      },
      attachments,
      reactions,
    };
  }

  private encodeCursor(createdAt: Date | string, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt: this.toIso(createdAt), id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
  }

  private toIso(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(String(value)).toISOString();
  }
}
