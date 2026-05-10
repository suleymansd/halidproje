import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { CompleteOnboardingDto } from '../auth/dto/complete-onboarding.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfile } from './interfaces/user-profile.interface';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findProfileById(userId: string, schoolId: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.username,
          u.bio,
          u.role,
          u.school_id,
          u.department_id,
          u.onboarding_completed,
          s.id AS school_ref_id,
          s.name AS school_name,
          d.id AS department_ref_id,
          d.name AS department_name
        FROM users u
        INNER JOIN schools s ON s.id = u.school_id
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1 AND u.school_id = $2
        LIMIT 1
      `,
      [userId, schoolId],
    );

    return result.rowCount ? this.mapProfile(result.rows[0]) : null;
  }

  async searchBySchool(schoolId: string, query: string) {
    const normalizedQuery = `%${query.trim().toLowerCase()}%`;
    const result = await this.pool.query(
      `
        SELECT id, email, full_name, username, role, department_id
        FROM users
        WHERE school_id = $1
          AND (
            $2 = '%%'
            OR lower(full_name) LIKE $2
            OR lower(email) LIKE $2
            OR lower(coalesce(username, '')) LIKE $2
          )
        ORDER BY full_name ASC
        LIMIT 20
      `,
      [schoolId, normalizedQuery],
    );

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      username: row.username,
      role: row.role,
      departmentId: row.department_id,
    }));
  }

  async findDepartmentByIdAndSchool(departmentId: string, schoolId: string) {
    const result = await this.pool.query(
      `SELECT id, name FROM departments WHERE id = $1 AND school_id = $2 LIMIT 1`,
      [departmentId, schoolId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async findByUsername(username: string): Promise<{ id: string } | null> {
    const result = await this.pool.query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [username],
    );

    return result.rowCount ? { id: result.rows[0].id } : null;
  }

  async updateUser(userId: string, schoolId: string, dto: UpdateUserDto): Promise<void> {
    await this.pool.query(
      `
        UPDATE users
        SET
          full_name = COALESCE($3, full_name),
          bio = COALESCE($4, bio),
          department_id = COALESCE($5, department_id),
          username = COALESCE($6, username),
          updated_at = now()
        WHERE id = $1 AND school_id = $2
      `,
      [
        userId,
        schoolId,
        dto.full_name ?? dto.fullName ?? null,
        dto.bio ?? null,
        dto.department_id ?? dto.departmentId ?? null,
        dto.username ?? null,
      ],
    );
  }

  async completeOnboarding(
    userId: string,
    schoolId: string,
    dto: CompleteOnboardingDto,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE users
        SET
          full_name = COALESCE($3, full_name),
          school_id = COALESCE($4, school_id),
          department_id = COALESCE($5, department_id),
          username = COALESCE($6, username),
          bio = COALESCE($7, bio),
          onboarding_completed = true,
          updated_at = now()
        WHERE id = $1 AND school_id = $2
      `,
      [
        userId,
        schoolId,
        dto.full_name ?? dto.fullName ?? null,
        dto.school_id ?? dto.schoolId ?? null,
        dto.department_id ?? dto.departmentId ?? null,
        dto.username ?? null,
        dto.bio ?? null,
      ],
    );
  }

  private mapProfile(row: Record<string, unknown>): UserProfile {
    return {
      id: String(row.id),
      email: String(row.email),
      fullName: String(row.full_name),
      username: row.username ? String(row.username) : null,
      bio: row.bio ? String(row.bio) : null,
      role: String(row.role),
      schoolId: String(row.school_id),
      departmentId: row.department_id ? String(row.department_id) : null,
      onboardingCompleted: Boolean(row.onboarding_completed),
      school: {
        id: String(row.school_ref_id),
        name: String(row.school_name),
      },
      department: row.department_ref_id
        ? {
            id: String(row.department_ref_id),
            name: String(row.department_name),
          }
        : null,
    };
  }
}
