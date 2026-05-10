import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(schoolId: string) {
    const result = await this.pool.query(
      `
        SELECT
          g.id,
          g.school_id,
          g.owner_id,
          g.name,
          g.slug,
          g.description,
          g.visibility,
          g.created_at,
          g.updated_at,
          owner.full_name AS owner_full_name,
          owner.username AS owner_username,
          room.id AS room_id,
          COUNT(DISTINCT member.user_id)::int AS member_count
        FROM groups g
        LEFT JOIN users owner ON owner.id = g.owner_id
        LEFT JOIN chat_rooms room
          ON room.group_id = g.id
         AND room.room_type = 'group'
         AND room.is_active = true
         AND room.is_archived = false
        LEFT JOIN chat_room_members member
          ON member.room_id = room.id
         AND member.is_active = true
         AND member.left_at IS NULL
        WHERE g.school_id = $1
          AND g.is_active = true
        GROUP BY
          g.id,
          g.school_id,
          g.owner_id,
          g.name,
          g.slug,
          g.description,
          g.visibility,
          g.created_at,
          g.updated_at,
          owner.full_name,
          owner.username,
          room.id
        ORDER BY g.created_at DESC, g.id DESC
      `,
      [schoolId],
    );

    return result.rows.map((row) => this.mapGroup(row));
  }

  async findById(schoolId: string, groupId: string) {
    const groupResult = await this.pool.query(
      `
        SELECT
          g.id,
          g.school_id,
          g.owner_id,
          g.name,
          g.slug,
          g.description,
          g.visibility,
          g.created_at,
          g.updated_at,
          owner.full_name AS owner_full_name,
          owner.username AS owner_username,
          room.id AS room_id
        FROM groups g
        LEFT JOIN users owner ON owner.id = g.owner_id
        LEFT JOIN chat_rooms room
          ON room.group_id = g.id
         AND room.room_type = 'group'
         AND room.is_active = true
         AND room.is_archived = false
        WHERE g.school_id = $1
          AND g.id = $2
          AND g.is_active = true
        LIMIT 1
      `,
      [schoolId, groupId],
    );

    if (!groupResult.rowCount) {
      return null;
    }

    const membersResult = await this.pool.query(
      `
        SELECT
          member.user_id,
          member.room_role,
          member.joined_at,
          u.full_name,
          u.username,
          u.email
        FROM chat_room_members member
        INNER JOIN users u ON u.id = member.user_id
        INNER JOIN chat_rooms room ON room.id = member.room_id
        WHERE room.school_id = $1
          AND room.group_id = $2
          AND room.room_type = 'group'
          AND member.is_active = true
          AND member.left_at IS NULL
        ORDER BY member.joined_at ASC, member.user_id ASC
      `,
      [schoolId, groupId],
    );

    return {
      ...this.mapGroup(groupResult.rows[0]),
      members: membersResult.rows.map((row) => ({
        id: row.user_id,
        fullName: row.full_name,
        username: row.username,
        email: row.email,
        roomRole: row.room_role,
        joinedAt: row.joined_at,
      })),
      memberCount: membersResult.rowCount,
    };
  }

  async create(schoolId: string, ownerId: string, dto: CreateGroupDto) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const slug = this.slugify(dto.name);
      const groupResult = await client.query(
        `
          INSERT INTO groups (
            school_id,
            owner_id,
            name,
            slug,
            description,
            visibility
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          schoolId,
          ownerId,
          dto.name.trim(),
          slug || null,
          dto.description?.trim() ?? null,
          dto.visibility,
        ],
      );

      const groupId = groupResult.rows[0].id as string;
      const roomResult = await client.query(
        `
          INSERT INTO chat_rooms (
            school_id,
            room_type,
            group_id,
            created_by,
            name,
            description
          )
          VALUES ($1, 'group', $2, $3, $4, $5)
          RETURNING id
        `,
        [
          schoolId,
          groupId,
          ownerId,
          dto.name.trim(),
          dto.description?.trim() ?? null,
        ],
      );

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
          VALUES ($1, $2, $3, 'owner', true, NULL)
        `,
        [schoolId, roomResult.rows[0].id, ownerId],
      );

      await client.query('COMMIT');
      return this.findById(schoolId, groupId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapGroup(row: Record<string, any>) {
    return {
      id: row.id,
      schoolId: row.school_id,
      ownerId: row.owner_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      visibility: row.visibility,
      roomId: row.room_id,
      memberCount: Number(row.member_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      owner: row.owner_id
        ? {
            id: row.owner_id,
            fullName: row.owner_full_name,
            username: row.owner_username,
          }
        : null,
    };
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);
  }
}
