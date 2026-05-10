import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';

@Injectable()
export class CoursesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Array<Record<string, unknown>>> {
    const result = await this.pool.query(
      `
        SELECT
          c.id,
          c.school_id,
          c.department_id,
          c.code,
          c.name,
          c.description,
          c.is_active,
          c.created_at,
          c.updated_at,
          d.name AS department_name,
          COALESCE(material_counts.material_count, 0) AS material_count
        FROM courses c
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS material_count
          FROM academic_materials am
          WHERE am.course_id = c.id
            AND am.deleted_at IS NULL
        ) material_counts ON true
        WHERE c.is_active = true
        ORDER BY c.name ASC
      `,
    );

    return result.rows.map((row) => this.mapCourse(row));
  }

  async findById(courseId: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `
        SELECT
          c.id,
          c.school_id,
          c.department_id,
          c.code,
          c.name,
          c.description,
          c.is_active,
          c.created_at,
          c.updated_at,
          d.name AS department_name,
          COALESCE(material_counts.material_count, 0) AS material_count
        FROM courses c
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS material_count
          FROM academic_materials am
          WHERE am.course_id = c.id
            AND am.deleted_at IS NULL
        ) material_counts ON true
        WHERE c.id = $1
          AND c.is_active = true
        LIMIT 1
      `,
      [courseId],
    );

    if (!result.rowCount) {
      return null;
    }

    return this.mapCourse(result.rows[0]);
  }

  private mapCourse(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      schoolId: row.school_id,
      departmentId: row.department_id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      materialCount: Number(row.material_count ?? 0),
      department: row.department_id
        ? {
            id: row.department_id,
            name: row.department_name,
          }
        : null,
    };
  }
}
