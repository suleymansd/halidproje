import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';

@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findAll(
    schoolId: string,
    limit = 50,
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.pool.query(
      `
        WITH events AS (
          SELECT
            'user_registered'::text AS action_type,
            u.created_at AS occurred_at,
            u.id AS user_id,
            u.full_name AS actor_name,
            u.email AS actor_email,
            json_build_object('role', u.role) AS metadata
          FROM users u
          WHERE u.school_id = $1

          UNION ALL

          SELECT
            'material_uploaded'::text AS action_type,
            am.created_at AS occurred_at,
            am.uploader_id AS user_id,
            u.full_name AS actor_name,
            u.email AS actor_email,
            json_build_object('materialId', am.id, 'title', am.title) AS metadata
          FROM academic_materials am
          INNER JOIN users u ON u.id = am.uploader_id
          WHERE am.school_id = $1
            AND am.deleted_at IS NULL

          UNION ALL

          SELECT
            'material_reported'::text AS action_type,
            mr.created_at AS occurred_at,
            mr.reporter_id AS user_id,
            u.full_name AS actor_name,
            u.email AS actor_email,
            json_build_object('reportId', mr.id, 'materialId', mr.material_id, 'status', mr.status) AS metadata
          FROM material_reports mr
          INNER JOIN users u ON u.id = mr.reporter_id
          WHERE mr.school_id = $1

          UNION ALL

          SELECT
            'message_reported'::text AS action_type,
            mr.created_at AS occurred_at,
            mr.reporter_id AS user_id,
            u.full_name AS actor_name,
            u.email AS actor_email,
            json_build_object('reportId', mr.id, 'messageId', mr.message_id, 'status', mr.status) AS metadata
          FROM message_reports mr
          INNER JOIN users u ON u.id = mr.reporter_id
          WHERE mr.school_id = $1
        )
        SELECT *
        FROM events
        ORDER BY occurred_at DESC
        LIMIT $2
      `,
      [schoolId, limit],
    );

    return result.rows.map((row) => ({
      actionType: row.action_type,
      occurredAt: row.occurred_at,
      userId: row.user_id,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      metadata: row.metadata ?? {},
    }));
  }

  async getAdminToolsOverview(schoolId: string): Promise<Record<string, unknown>> {
    const [registrations, reports, uploads] = await Promise.all([
      this.pool.query(
        `
          SELECT id, email, full_name, role, created_at
          FROM users
          WHERE school_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [schoolId],
      ),
      this.pool.query(
        `
          WITH reports AS (
            SELECT id, 'message'::text AS reference_type, status::text AS status, created_at
            FROM message_reports
            WHERE school_id = $1
            UNION ALL
            SELECT id, 'material'::text AS reference_type, status::text AS status, created_at
            FROM material_reports
            WHERE school_id = $1
          )
          SELECT *
          FROM reports
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [schoolId],
      ),
      this.pool.query(
        `
          SELECT am.id, am.title, am.created_at, am.uploader_id, u.full_name AS uploader_name
          FROM academic_materials am
          INNER JOIN users u ON u.id = am.uploader_id
          WHERE am.school_id = $1
            AND am.deleted_at IS NULL
          ORDER BY am.created_at DESC
          LIMIT 10
        `,
        [schoolId],
      ),
    ]);

    return {
      recentRegistrations: registrations.rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        createdAt: row.created_at,
      })),
      recentReports: reports.rows.map((row) => ({
        id: row.id,
        referenceType: row.reference_type,
        status: row.status,
        createdAt: row.created_at,
      })),
      recentMaterialUploads: uploads.rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        uploaderId: row.uploader_id,
        uploaderName: row.uploader_name,
      })),
    };
  }
}
