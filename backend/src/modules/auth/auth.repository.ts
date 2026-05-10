import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { AuthUser } from './interfaces/auth-user.interface';

interface CreateUserInput {
  email: string;
  fullName: string;
  passwordHash: string;
  schoolId: string;
  departmentId: string;
  username: string | null;
  onboardingCompleted: boolean;
  role: string;
}

interface SchoolRecord {
  id: string;
  name: string;
}

interface CreateSessionInput {
  id: string;
  userId: string;
  schoolId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

interface SessionRecord {
  id: string;
  userId: string;
  schoolId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface UserWithPassword extends AuthUser {
  passwordHash: string;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, full_name, school_id, department_id, username, role
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email],
    );

    return result.rowCount ? this.mapAuthUser(result.rows[0]) : null;
  }

  async findUserWithPasswordByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, full_name, school_id, department_id, username, role, password_hash
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [email],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...this.mapAuthUser(row),
      passwordHash: row.password_hash,
    };
  }

  async findUserByUsername(username: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, full_name, school_id, department_id, username, role
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [username],
    );

    return result.rowCount ? this.mapAuthUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, email, full_name, school_id, department_id, username, role
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rowCount ? this.mapAuthUser(result.rows[0]) : null;
  }

  async createUser(input: CreateUserInput): Promise<AuthUser> {
    const result = await this.pool.query(
      `
        INSERT INTO users (
          email,
          full_name,
          password_hash,
          school_id,
          department_id,
          username,
          role,
          onboarding_completed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, full_name, school_id, department_id, username, role
      `,
      [
        input.email,
        input.fullName,
        input.passwordHash,
        input.schoolId,
        input.departmentId,
        input.username,
        input.role,
        input.onboardingCompleted,
      ],
    );

    return this.mapAuthUser(result.rows[0]);
  }

  async findDefaultSchool(): Promise<SchoolRecord | null> {
    const configuredSlug = process.env.SEED_SCHOOL_SLUG ?? 'isu-universitesi';
    const configuredName = process.env.SEED_SCHOOL_NAME ?? 'İsü Üniversitesi';

    const bySlug = await this.pool.query(
      `
        SELECT id, name
        FROM schools
        WHERE slug = $1
        LIMIT 1
      `,
      [configuredSlug],
    );

    if (bySlug.rowCount) {
      return {
        id: bySlug.rows[0].id,
        name: bySlug.rows[0].name,
      };
    }

    const byName = await this.pool.query(
      `
        SELECT id, name
        FROM schools
        WHERE name = $1
        LIMIT 1
      `,
      [configuredName],
    );

    if (byName.rowCount) {
      return {
        id: byName.rows[0].id,
        name: byName.rows[0].name,
      };
    }

    const firstSchool = await this.pool.query(
      `
        SELECT id, name
        FROM schools
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
    );

    return firstSchool.rowCount
      ? {
          id: firstSchool.rows[0].id,
          name: firstSchool.rows[0].name,
        }
      : null;
  }

  async findSchoolById(schoolId: string): Promise<{ id: string; name: string } | null> {
    const result = await this.pool.query(
      `SELECT id, name FROM schools WHERE id = $1 LIMIT 1`,
      [schoolId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async findDepartmentByIdAndSchool(
    departmentId: string,
    schoolId: string,
  ): Promise<{ id: string; name: string } | null> {
    const result = await this.pool.query(
      `
        SELECT id, name
        FROM departments
        WHERE id = $1 AND school_id = $2
        LIMIT 1
      `,
      [departmentId, schoolId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO user_sessions (
          id,
          user_id,
          school_id,
          refresh_token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        input.id,
        input.userId,
        input.schoolId,
        input.refreshTokenHash,
        input.expiresAt,
      ],
    );
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      `
        SELECT id, user_id, school_id, refresh_token_hash, expires_at, revoked_at
        FROM user_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      schoolId: row.school_id,
      refreshTokenHash: row.refresh_token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async rotateSessionRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE user_sessions
        SET refresh_token_hash = $2,
            expires_at = $3,
            revoked_at = NULL,
            updated_at = now()
        WHERE id = $1
      `,
      [sessionId, refreshTokenHash, expiresAt],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE user_sessions
        SET revoked_at = now(), updated_at = now()
        WHERE id = $1
      `,
      [sessionId],
    );
  }

  async addUserToDefaultRooms(
    userId: string,
    schoolId: string,
    departmentId: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const generalRoom = await client.query(
        `
          SELECT id
          FROM chat_rooms
          WHERE school_id = $1
            AND room_type = 'general'
            AND is_active = true
            AND is_archived = false
          LIMIT 1
        `,
        [schoolId],
      );

      if (generalRoom.rowCount) {
        await this.upsertRoomMember(client, schoolId, generalRoom.rows[0].id, userId);
      }

      const departmentRoom = await client.query(
        `
          SELECT id
          FROM chat_rooms
          WHERE school_id = $1
            AND room_type = 'department'
            AND department_id = $2
            AND is_active = true
            AND is_archived = false
          LIMIT 1
        `,
        [schoolId, departmentId],
      );

      if (departmentRoom.rowCount) {
        await this.upsertRoomMember(client, schoolId, departmentRoom.rows[0].id, userId);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertRoomMember(
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

  private mapAuthUser(row: Record<string, unknown>): AuthUser {
    return {
      id: String(row.id),
      email: String(row.email),
      fullName: String(row.full_name),
      schoolId: String(row.school_id),
      departmentId: row.department_id ? String(row.department_id) : null,
      username: row.username ? String(row.username) : null,
      role: String(row.role ?? 'student'),
    };
  }
}
