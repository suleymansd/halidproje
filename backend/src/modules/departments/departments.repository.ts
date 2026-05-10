import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';

@Injectable()
export class DepartmentsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Array<Record<string, unknown>>> {
    const result = await this.pool.query(
      `
        SELECT id, school_id, name, code, description, is_active
        FROM departments
        WHERE is_active = true
        ORDER BY name ASC
      `,
    );

    return result.rows.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      name: row.name,
      code: row.code,
      description: row.description,
      isActive: row.is_active,
    }));
  }

  async findById(departmentId: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `
        SELECT id, school_id, name, code, description, is_active
        FROM departments
        WHERE id = $1
        LIMIT 1
      `,
      [departmentId],
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      schoolId: row.school_id,
      name: row.name,
      code: row.code,
      description: row.description,
      isActive: row.is_active,
    };
  }
}
