import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { BookmarkMaterialDto } from './dto/bookmark-material.dto';
import { CommentMaterialDto } from './dto/comment-material.dto';
import { ListMaterialsDto } from './dto/list-materials.dto';
import { ReportMaterialDto } from './dto/report-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { VoteMaterialDto } from './dto/vote-material.dto';

@Injectable()
export class AcademicMaterialsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findMaterials(
    schoolId: string,
    query: ListMaterialsDto,
    userId: string,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const sortBy = query.sortBy ?? 'newest';
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const tags = this.parseTags(query.tags);
    const params: Array<string | number | string[]> = [schoolId];
    const where: string[] = ['m.school_id = $1', 'm.deleted_at IS NULL'];

    if (query.departmentId) {
      params.push(query.departmentId);
      where.push(`m.department_id = $${params.length}`);
    }

    if (query.courseId) {
      params.push(query.courseId);
      where.push(`m.course_id = $${params.length}`);
    }

    let joins = '';
    if (tags.length > 0) {
      params.push(tags);
      joins += `
        INNER JOIN (
          SELECT atm.material_id
          FROM academic_material_tag_map atm
          INNER JOIN material_tags mt
            ON mt.id = atm.tag_id
          WHERE mt.school_id = $1
            AND mt.slug = ANY($${params.length}::text[])
          GROUP BY atm.material_id
          HAVING COUNT(DISTINCT mt.slug) = ${tags.length}
        ) tag_filter
          ON tag_filter.material_id = m.id
      `;
    }

    const orderBy =
      sortBy === 'most_upvoted'
        ? 'm.vote_score DESC, m.created_at DESC, m.id DESC'
        : 'm.created_at DESC, m.id DESC';

    if (cursor) {
      if (sortBy === 'most_upvoted') {
        params.push(Number(cursor.primary), cursor.createdAt, cursor.id);
        where.push(
          `(m.vote_score, m.created_at, m.id) < ($${params.length - 2}, $${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      } else {
        params.push(cursor.createdAt, cursor.id);
        where.push(
          `(m.created_at, m.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      }
    }

    params.push(query.limit + 1, userId);
    const limitParam = `$${params.length - 1}`;
    const userIdParam = `$${params.length}`;

    const result = await this.pool.query(
      `
        SELECT
          m.id,
          m.school_id,
          m.uploader_id,
          m.course_id,
          m.department_id,
          m.title,
          m.description,
          m.material_type,
          m.download_count,
          m.comment_count,
          m.vote_score,
          m.created_at,
          m.updated_at,
          m.deleted_at,
          uploader.full_name AS uploader_full_name,
          uploader.username AS uploader_username,
          uploader.role AS uploader_role,
          dept.name AS department_name,
          course.name AS course_name,
          file_row.id AS file_id,
          file_row.storage_url,
          file_row.filename,
          file_row.file_type,
          file_row.file_size,
          EXISTS (
            SELECT 1
            FROM material_bookmarks mb
            WHERE mb.school_id = m.school_id
              AND mb.material_id = m.id
              AND mb.user_id = ${userIdParam}
          ) AS bookmarked_by_me,
          COALESCE((
            SELECT mv.vote
            FROM material_votes mv
            WHERE mv.school_id = m.school_id
              AND mv.material_id = m.id
              AND mv.user_id = ${userIdParam}
            LIMIT 1
          ), 0) AS my_vote,
          COALESCE((
            SELECT json_agg(json_build_object('id', mt.id, 'name', mt.name, 'slug', mt.slug) ORDER BY mt.name)
            FROM academic_material_tag_map atm
            INNER JOIN material_tags mt ON mt.id = atm.tag_id
            WHERE atm.material_id = m.id
          ), '[]'::json) AS tags
        FROM academic_materials m
        ${joins}
        INNER JOIN users uploader ON uploader.id = m.uploader_id
        LEFT JOIN departments dept ON dept.id = m.department_id
        LEFT JOIN courses course ON course.id = m.course_id
        LEFT JOIN LATERAL (
          SELECT mf.id, mf.storage_url, mf.filename, mf.file_type, mf.file_size
          FROM material_files mf
          WHERE mf.material_id = m.id
          ORDER BY mf.created_at ASC
          LIMIT 1
        ) file_row ON true
        WHERE ${where.join('\n          AND ')}
        ORDER BY ${orderBy}
        LIMIT ${limitParam}
      `,
      params,
    );

    const hasMore = result.rows.length > query.limit;
    const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;

    return {
      items: rows.map((row) => this.mapMaterialRow(row)),
      nextCursor:
        hasMore && rows.length > 0
          ? this.encodeCursor(
              sortBy === 'most_upvoted' ? rows[rows.length - 1].vote_score : null,
              rows[rows.length - 1].created_at,
              rows[rows.length - 1].id,
            )
          : null,
    };
  }

  async findMaterialById(
    schoolId: string,
    materialId: string,
    userId: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT
          m.id,
          m.school_id,
          m.uploader_id,
          m.course_id,
          m.department_id,
          m.title,
          m.description,
          m.material_type,
          m.download_count,
          m.comment_count,
          m.vote_score,
          m.created_at,
          m.updated_at,
          m.deleted_at,
          uploader.full_name AS uploader_full_name,
          uploader.username AS uploader_username,
          uploader.role AS uploader_role,
          dept.name AS department_name,
          course.name AS course_name,
          EXISTS (
            SELECT 1
            FROM material_bookmarks mb
            WHERE mb.school_id = m.school_id
              AND mb.material_id = m.id
              AND mb.user_id = $3
          ) AS bookmarked_by_me,
          COALESCE((
            SELECT mv.vote
            FROM material_votes mv
            WHERE mv.school_id = m.school_id
              AND mv.material_id = m.id
              AND mv.user_id = $3
            LIMIT 1
          ), 0) AS my_vote,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', mf.id,
                'storageUrl', mf.storage_url,
                'filename', mf.filename,
                'fileType', mf.file_type,
                'fileSize', mf.file_size,
                'createdAt', mf.created_at
              )
              ORDER BY mf.created_at ASC
            )
            FROM material_files mf
            WHERE mf.material_id = m.id
          ), '[]'::json) AS files,
          COALESCE((
            SELECT json_agg(json_build_object('id', mt.id, 'name', mt.name, 'slug', mt.slug) ORDER BY mt.name)
            FROM academic_material_tag_map atm
            INNER JOIN material_tags mt ON mt.id = atm.tag_id
            WHERE atm.material_id = m.id
          ), '[]'::json) AS tags
        FROM academic_materials m
        INNER JOIN users uploader ON uploader.id = m.uploader_id
        LEFT JOIN departments dept ON dept.id = m.department_id
        LEFT JOIN courses course ON course.id = m.course_id
        WHERE m.school_id = $1
          AND m.id = $2
        LIMIT 1
      `,
      [schoolId, materialId, userId],
    );

    return result.rowCount ? this.mapMaterialRow(result.rows[0], true) : null;
  }

  async createMaterial(
    schoolId: string,
    uploaderId: string,
    dto: UploadMaterialDto,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const materialResult = await client.query(
        `
          INSERT INTO academic_materials (
            school_id,
            uploader_id,
            course_id,
            department_id,
            title,
            description,
            material_type
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          schoolId,
          uploaderId,
          dto.courseId ?? null,
          dto.departmentId ?? null,
          dto.title.trim(),
          dto.description?.trim() ?? null,
          dto.materialType.trim(),
        ],
      );

      const materialId = materialResult.rows[0].id;

      await client.query(
        `
          INSERT INTO material_files (
            school_id,
            material_id,
            storage_url,
            filename,
            file_type,
            file_size
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          schoolId,
          materialId,
          dto.storageUrl,
          dto.filename,
          dto.fileType,
          dto.fileSize,
        ],
      );

      await this.syncTags(client, schoolId, materialId, dto.tags);
      await client.query('COMMIT');

      return this.findMaterialById(schoolId, materialId, uploaderId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMaterial(
    schoolId: string,
    materialId: string,
    dto: UpdateMaterialDto,
    userId: string,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `
          UPDATE academic_materials
          SET
            title = COALESCE($3, title),
            description = COALESCE($4, description),
            course_id = COALESCE($5, course_id),
            department_id = COALESCE($6, department_id),
            updated_at = now()
          WHERE school_id = $1
            AND id = $2
            AND deleted_at IS NULL
          RETURNING id
        `,
        [
          schoolId,
          materialId,
          dto.title?.trim() ?? null,
          dto.description?.trim() ?? null,
          dto.courseId ?? null,
          dto.departmentId ?? null,
        ],
      );

      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }

      if (dto.tags !== undefined) {
        await client.query(
          `
            DELETE FROM academic_material_tag_map
            WHERE material_id = $1
          `,
          [materialId],
        );
        await this.syncTags(client, schoolId, materialId, dto.tags);
      }

      await client.query('COMMIT');
      return this.findMaterialById(schoolId, materialId, userId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async softDeleteMaterial(schoolId: string, materialId: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE academic_materials
        SET deleted_at = now(), updated_at = now()
        WHERE school_id = $1
          AND id = $2
          AND deleted_at IS NULL
      `,
      [schoolId, materialId],
    );
  }

  async findMaterialComments(
    schoolId: string,
    materialId: string,
  ): Promise<unknown[]> {
    const result = await this.pool.query(
      `
        SELECT
          mc.id,
          mc.material_id,
          mc.school_id,
          mc.user_id,
          mc.parent_comment_id,
          mc.body,
          mc.created_at,
          mc.updated_at,
          mc.deleted_at,
          u.full_name,
          u.username,
          u.role
        FROM material_comments mc
        INNER JOIN users u ON u.id = mc.user_id
        WHERE mc.school_id = $1
          AND mc.material_id = $2
          AND mc.deleted_at IS NULL
        ORDER BY mc.created_at ASC, mc.id ASC
      `,
      [schoolId, materialId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      materialId: row.material_id,
      schoolId: row.school_id,
      userId: row.user_id,
      parentCommentId: row.parent_comment_id,
      content: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        id: row.user_id,
        fullName: row.full_name,
        username: row.username,
        role: row.role,
      },
    }));
  }

  async findMaterialCommentById(
    schoolId: string,
    materialId: string,
    commentId: string,
  ): Promise<any | null> {
    const result = await this.pool.query(
      `
        SELECT id, material_id, parent_comment_id
        FROM material_comments
        WHERE school_id = $1
          AND material_id = $2
          AND id = $3
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [schoolId, materialId, commentId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async createMaterialComment(
    schoolId: string,
    materialId: string,
    userId: string,
    dto: CommentMaterialDto,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `
          INSERT INTO material_comments (
            school_id,
            material_id,
            user_id,
            parent_comment_id,
            body
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [schoolId, materialId, userId, dto.parentCommentId ?? null, dto.content.trim()],
      );

      await this.refreshMaterialCommentCount(client, materialId);
      await client.query('COMMIT');

      const comments = await this.findMaterialComments(schoolId, materialId);
      return comments.find(
        (comment) => (comment as { id: string }).id === result.rows[0].id,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertMaterialVote(
    schoolId: string,
    materialId: string,
    userId: string,
    dto: VoteMaterialDto,
  ): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `
          INSERT INTO material_votes (
            school_id,
            material_id,
            user_id,
            vote
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (material_id, user_id)
          DO UPDATE SET vote = EXCLUDED.vote
        `,
        [schoolId, materialId, userId, dto.vote],
      );

      await this.refreshMaterialVoteScore(client, materialId);
      await client.query('COMMIT');

      return {
        materialId,
        userId,
        vote: dto.vote,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteMaterialVote(
    schoolId: string,
    materialId: string,
    userId: string,
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `
          DELETE FROM material_votes
          WHERE school_id = $1
            AND material_id = $2
            AND user_id = $3
        `,
        [schoolId, materialId, userId],
      );
      await this.refreshMaterialVoteScore(client, materialId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createMaterialBookmark(
    schoolId: string,
    materialId: string,
    userId: string,
    dto: BookmarkMaterialDto,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        INSERT INTO material_bookmarks (
          school_id,
          material_id,
          user_id,
          note
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (material_id, user_id)
        DO UPDATE SET note = EXCLUDED.note
        RETURNING id, material_id, user_id, note, created_at
      `,
      [schoolId, materialId, userId, dto.note?.trim() ?? null],
    );

    return {
      id: result.rows[0].id,
      materialId: result.rows[0].material_id,
      userId: result.rows[0].user_id,
      note: result.rows[0].note,
      createdAt: result.rows[0].created_at,
    };
  }

  async deleteMaterialBookmark(
    schoolId: string,
    materialId: string,
    userId: string,
  ): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM material_bookmarks
        WHERE school_id = $1
          AND material_id = $2
          AND user_id = $3
      `,
      [schoolId, materialId, userId],
    );
  }

  async createMaterialReport(
    schoolId: string,
    materialId: string,
    reporterId: string,
    dto: ReportMaterialDto,
  ): Promise<any> {
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
          reviewed_at = NULL
        RETURNING id, material_id, reporter_id, reason, description, status, reviewed_by, reviewed_at, created_at
      `,
      [schoolId, materialId, reporterId, dto.reason, dto.description?.trim() ?? null],
    );

    return {
      id: result.rows[0].id,
      materialId: result.rows[0].material_id,
      reporterId: result.rows[0].reporter_id,
      reason: result.rows[0].reason,
      description: result.rows[0].description,
      status: result.rows[0].status,
      reviewedBy: result.rows[0].reviewed_by,
      reviewedAt: result.rows[0].reviewed_at,
      createdAt: result.rows[0].created_at,
    };
  }

  async resolveMaterialReport(
    schoolId: string,
    reportId: string,
    reviewerId: string,
  ): Promise<any> {
    const result = await this.pool.query(
      `
        UPDATE material_reports
        SET
          status = 'resolved',
          reviewed_by = $3,
          reviewed_at = now()
        WHERE school_id = $1
          AND id = $2
        RETURNING id, material_id, reporter_id, reason, description, status, reviewed_by, reviewed_at, created_at
      `,
      [schoolId, reportId, reviewerId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async findDepartmentById(schoolId: string, departmentId: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT id, school_id, name FROM departments WHERE id = $1 AND school_id = $2 LIMIT 1`,
      [departmentId, schoolId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async findCourseById(schoolId: string, courseId: string): Promise<any | null> {
    const exists = await this.pool.query(
      `SELECT to_regclass('public.courses') AS table_name`,
    );

    if (!exists.rows[0]?.table_name) {
      return null;
    }

    const result = await this.pool.query(
      `
        SELECT id, school_id, department_id, name
        FROM courses
        WHERE id = $1
          AND school_id = $2
          AND is_active = true
        LIMIT 1
      `,
      [courseId, schoolId],
    );

    return result.rowCount
      ? {
          id: result.rows[0].id,
          schoolId: result.rows[0].school_id,
          departmentId: result.rows[0].department_id,
          name: result.rows[0].name,
        }
      : null;
  }

  private async syncTags(
    client: PoolClient,
    schoolId: string,
    materialId: string,
    tags: string[],
  ): Promise<void> {
    for (const tagName of tags) {
      const slug = this.slugify(tagName);
      const tagResult = await client.query(
        `
          INSERT INTO material_tags (school_id, name, slug)
          VALUES ($1, $2, $3)
          ON CONFLICT (school_id, slug)
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `,
        [schoolId, tagName, slug],
      );

      await client.query(
        `
          INSERT INTO academic_material_tag_map (material_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT (material_id, tag_id) DO NOTHING
        `,
        [materialId, tagResult.rows[0].id],
      );
    }
  }

  private async refreshMaterialCommentCount(
    client: PoolClient,
    materialId: string,
  ): Promise<void> {
    await client.query(
      `
        UPDATE academic_materials
        SET
          comment_count = (
            SELECT COUNT(*)
            FROM material_comments
            WHERE material_id = $1
              AND deleted_at IS NULL
          ),
          updated_at = now()
        WHERE id = $1
      `,
      [materialId],
    );
  }

  private async refreshMaterialVoteScore(
    client: PoolClient,
    materialId: string,
  ): Promise<void> {
    await client.query(
      `
        UPDATE academic_materials
        SET
          vote_score = COALESCE((
            SELECT SUM(vote)
            FROM material_votes
            WHERE material_id = $1
          ), 0),
          updated_at = now()
        WHERE id = $1
      `,
      [materialId],
    );
  }

  private parseTags(tags?: string): string[] {
    if (!tags) {
      return [];
    }

    return [...new Set(tags.split(',').map((tag) => this.slugify(tag)).filter(Boolean))];
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private encodeCursor(
    primary: number | null,
    createdAt: string,
    id: string,
  ): string {
    return Buffer.from(
      JSON.stringify({
        primary,
        createdAt,
        id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): {
    primary: number | null;
    createdAt: string;
    id: string;
  } {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      primary: number | null;
      createdAt: string;
      id: string;
    };
  }

  private mapMaterialRow(row: Record<string, any>, includeCollections = false): any {
    return {
      id: row.id,
      schoolId: row.school_id,
      uploaderId: row.uploader_id,
      courseId: row.course_id,
      departmentId: row.department_id,
      title: row.title,
      description: row.description,
      materialType: row.material_type,
      downloadCount: Number(row.download_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
      voteScore: Number(row.vote_score ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      uploader: {
        id: row.uploader_id,
        fullName: row.uploader_full_name,
        username: row.uploader_username,
        role: row.uploader_role,
      },
      department: row.department_id
        ? {
            id: row.department_id,
            name: row.department_name,
          }
        : null,
      course: row.course_id
        ? {
            id: row.course_id,
            name: row.course_name,
          }
        : null,
      file: row.file_id
        ? {
            id: row.file_id,
            storageUrl: row.storage_url,
            filename: row.filename,
            fileType: row.file_type,
            fileSize: row.file_size,
          }
        : null,
      files: includeCollections ? row.files ?? [] : undefined,
      tags: row.tags ?? [],
      bookmarkedByMe: row.bookmarked_by_me,
      myVote: Number(row.my_vote ?? 0),
    };
  }
}
