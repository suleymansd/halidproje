import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ModerationActionPayload } from './interfaces/moderation-action.interface';

@Injectable()
export class ModerationRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async createReport(
    schoolId: string,
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<Record<string, unknown>> {
    if (dto.referenceType === 'message') {
      const result = await this.pool.query(
        `
          INSERT INTO message_reports (
            school_id,
            message_id,
            reporter_id,
            reason,
            description
          )
          VALUES ($1, $2, $3, $4::chat_report_reason, $5)
          ON CONFLICT (message_id, reporter_id)
          DO UPDATE SET
            reason = EXCLUDED.reason,
            description = EXCLUDED.description,
            status = 'open',
            reviewed_by = NULL,
            reviewed_at = NULL,
            updated_at = now()
          RETURNING id
        `,
        [schoolId, dto.referenceId, reporterId, dto.reason, dto.description ?? null],
      );

      return (await this.findReportById(schoolId, result.rows[0].id)) ?? {};
    }

    if (dto.referenceType === 'material') {
      const result = await this.pool.query(
        `
          INSERT INTO material_reports (
            school_id,
            material_id,
            reporter_id,
            reason,
            description
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (material_id, reporter_id)
          DO UPDATE SET
            reason = EXCLUDED.reason,
            description = EXCLUDED.description,
            status = 'open',
            reviewed_by = NULL,
            reviewed_at = NULL,
            updated_at = now()
          RETURNING id
        `,
        [schoolId, dto.referenceId, reporterId, dto.reason, dto.description ?? null],
      );

      return (await this.findReportById(schoolId, result.rows[0].id)) ?? {};
    }

    throw new Error('User reports are not supported in the current MVP schema');
  }

  async findReports(
    schoolId: string,
    query: ListReportsDto,
  ): Promise<unknown[]> {
    const params: Array<string | number> = [schoolId];
    const typeFilter = query.referenceType
      ? `AND report.reference_type = $${params.push(query.referenceType)}`
      : '';
    const statusFilter = query.status
      ? `AND report.status = $${params.push(query.status)}`
      : '';
    const limitParam = `$${params.push(query.limit)}`;

    const result = await this.pool.query(
      `
        WITH report AS (
          SELECT
            mr.id,
            mr.school_id,
            'message'::text AS reference_type,
            mr.message_id AS reference_id,
            mr.reason::text AS reason,
            mr.description,
            mr.status::text AS status,
            mr.reporter_id,
            mr.reviewed_by,
            mr.reviewed_at,
            mr.created_at,
            msg.content AS subject_preview,
            msg.sender_id AS target_user_id,
            target_user.full_name AS target_user_full_name,
            target_user.username AS target_user_username,
            reporter.full_name AS reporter_full_name,
            reporter.username AS reporter_username,
            reviewer.full_name AS reviewer_full_name
          FROM message_reports mr
          INNER JOIN messages msg ON msg.id = mr.message_id
          INNER JOIN users reporter ON reporter.id = mr.reporter_id
          LEFT JOIN users target_user ON target_user.id = msg.sender_id
          LEFT JOIN users reviewer ON reviewer.id = mr.reviewed_by
          WHERE mr.school_id = $1

          UNION ALL

          SELECT
            mr.id,
            mr.school_id,
            'material'::text AS reference_type,
            mr.material_id AS reference_id,
            mr.reason::text AS reason,
            mr.description,
            mr.status::text AS status,
            mr.reporter_id,
            mr.reviewed_by,
            mr.reviewed_at,
            mr.created_at,
            am.title AS subject_preview,
            am.uploader_id AS target_user_id,
            target_user.full_name AS target_user_full_name,
            target_user.username AS target_user_username,
            reporter.full_name AS reporter_full_name,
            reporter.username AS reporter_username,
            reviewer.full_name AS reviewer_full_name
          FROM material_reports mr
          INNER JOIN academic_materials am ON am.id = mr.material_id
          INNER JOIN users reporter ON reporter.id = mr.reporter_id
          LEFT JOIN users target_user ON target_user.id = am.uploader_id
          LEFT JOIN users reviewer ON reviewer.id = mr.reviewed_by
          WHERE mr.school_id = $1
        )
        SELECT *
        FROM report
        WHERE 1 = 1
          ${typeFilter}
          ${statusFilter}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitParam}
      `,
      params,
    );

    return result.rows.map((row) => this.mapReport(row));
  }

  async findReportById(
    schoolId: string,
    reportId: string,
  ): Promise<{
    id: string;
    schoolId: string;
    reporterId: string;
    status: string;
  } | null> {
    const result = await this.pool.query(
      `
        WITH report AS (
          SELECT
            mr.id,
            mr.school_id,
            'message'::text AS reference_type,
            mr.message_id AS reference_id,
            mr.reason::text AS reason,
            mr.description,
            mr.status::text AS status,
            mr.reporter_id,
            mr.reviewed_by,
            mr.reviewed_at,
            mr.created_at,
            msg.content AS subject_preview,
            msg.sender_id AS target_user_id,
            target_user.full_name AS target_user_full_name,
            target_user.username AS target_user_username,
            reporter.full_name AS reporter_full_name,
            reporter.username AS reporter_username,
            reviewer.full_name AS reviewer_full_name
          FROM message_reports mr
          INNER JOIN messages msg ON msg.id = mr.message_id
          INNER JOIN users reporter ON reporter.id = mr.reporter_id
          LEFT JOIN users target_user ON target_user.id = msg.sender_id
          LEFT JOIN users reviewer ON reviewer.id = mr.reviewed_by
          WHERE mr.school_id = $1
            AND mr.id = $2

          UNION ALL

          SELECT
            mr.id,
            mr.school_id,
            'material'::text AS reference_type,
            mr.material_id AS reference_id,
            mr.reason::text AS reason,
            mr.description,
            mr.status::text AS status,
            mr.reporter_id,
            mr.reviewed_by,
            mr.reviewed_at,
            mr.created_at,
            am.title AS subject_preview,
            am.uploader_id AS target_user_id,
            target_user.full_name AS target_user_full_name,
            target_user.username AS target_user_username,
            reporter.full_name AS reporter_full_name,
            reporter.username AS reporter_username,
            reviewer.full_name AS reviewer_full_name
          FROM material_reports mr
          INNER JOIN academic_materials am ON am.id = mr.material_id
          INNER JOIN users reporter ON reporter.id = mr.reporter_id
          LEFT JOIN users target_user ON target_user.id = am.uploader_id
          LEFT JOIN users reviewer ON reviewer.id = mr.reviewed_by
          WHERE mr.school_id = $1
            AND mr.id = $2
        )
        SELECT *
        FROM report
        LIMIT 1
      `,
      [schoolId, reportId],
    );

    if (!result.rowCount) {
      return null;
    }

    return this.mapReport(result.rows[0]) as {
      id: string;
      schoolId: string;
      reporterId: string;
      status: string;
    };
  }

  async reviewReport(
    schoolId: string,
    reportId: string,
    reviewerId: string,
    dto: ReviewReportDto,
  ): Promise<Record<string, unknown> | null> {
    const messageResult = await this.pool.query(
      `
        UPDATE message_reports
        SET
          status = $3::chat_report_status,
          reviewed_by = $4,
          reviewed_at = now(),
          updated_at = now()
        WHERE school_id = $1
          AND id = $2
        RETURNING id
      `,
      [schoolId, reportId, dto.status, reviewerId],
    );

    if (messageResult.rowCount) {
      return this.findReportById(schoolId, reportId);
    }

    const materialResult = await this.pool.query(
      `
        UPDATE material_reports
        SET
          status = $3,
          reviewed_by = $4,
          reviewed_at = now(),
          updated_at = now()
        WHERE school_id = $1
          AND id = $2
        RETURNING id
      `,
      [schoolId, reportId, dto.status, reviewerId],
    );

    if (!materialResult.rowCount) {
      return null;
    }

    return this.findReportById(schoolId, reportId);
  }

  async createModerationCase(
    schoolId: string,
    createdBy: string,
    dto: CreateCaseDto,
  ): Promise<Record<string, unknown>> {
    return {
      id: randomUUID(),
      schoolId,
      createdBy,
      reportIds: dto.reportIds,
      note: dto.note ?? null,
      status: 'open',
      createdAt: new Date().toISOString(),
      isEphemeral: true,
    };
  }

  async findCases(schoolId: string): Promise<unknown[]> {
    void schoolId;
    return [];
  }

  async findCaseById(
    schoolId: string,
    caseId: string,
  ): Promise<{
    id: string;
    schoolId: string;
    status: string;
  } | null> {
    void schoolId;
    void caseId;
    return null;
  }

  async assignCase(
    schoolId: string,
    caseId: string,
    actorUserId: string,
    dto: AssignCaseDto,
  ): Promise<Record<string, unknown>> {
    return {
      id: caseId,
      schoolId,
      assignedTo: dto.assignedModeratorId,
      assignedBy: actorUserId,
      updatedAt: new Date().toISOString(),
      isEphemeral: true,
    };
  }

  async closeCase(
    schoolId: string,
    caseId: string,
    actorUserId: string,
    dto: CloseCaseDto,
  ): Promise<Record<string, unknown>> {
    return {
      id: caseId,
      schoolId,
      status: dto.status,
      note: dto.note ?? null,
      closedBy: actorUserId,
      closedAt: new Date().toISOString(),
      isEphemeral: true,
    };
  }

  async createModerationAction(
    schoolId: string,
    moderatorId: string,
    payload: ModerationActionPayload,
  ): Promise<Record<string, unknown>> {
    return {
      id: randomUUID(),
      schoolId,
      moderatorId,
      ...payload,
      createdAt: new Date().toISOString(),
      isEphemeral: true,
    };
  }

  private mapReport(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      schoolId: row.school_id,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      reporterId: row.reporter_id,
      status: row.status,
      reason: row.reason,
      description: row.description,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      subjectPreview: row.subject_preview,
      targetUser: row.target_user_id
        ? {
            id: row.target_user_id,
            fullName: row.target_user_full_name,
            username: row.target_user_username,
          }
        : null,
      reporter: {
        id: row.reporter_id,
        fullName: row.reporter_full_name,
        username: row.reporter_username,
      },
      reviewer: row.reviewed_by
        ? {
            id: row.reviewed_by,
            fullName: row.reviewer_full_name,
          }
        : null,
    };
  }
}
