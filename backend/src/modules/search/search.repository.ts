import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';
import { SearchGroupsDto } from './dto/search-groups.dto';
import { SearchMaterialsDto } from './dto/search-materials.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SearchResult } from './interfaces/search-result.interface';

@Injectable()
export class SearchRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async searchAll(
    schoolId: string,
    query: SearchQueryDto,
  ): Promise<{ results: SearchResult[]; nextCursor: string | null }> {
    const [materials, users, groups] = await Promise.all([
      this.searchMaterials(schoolId, query),
      this.searchUsers(schoolId, query),
      this.searchGroups(schoolId, query),
    ]);

    const limit = query.limit ?? 20;
    const combined = [...materials.results, ...users.results, ...groups.results]
      .sort((left, right) => {
        if (right.relevanceScore !== left.relevanceScore) {
          return right.relevanceScore - left.relevanceScore;
        }

        const rightDate = right.createdAt ? Date.parse(right.createdAt) : 0;
        const leftDate = left.createdAt ? Date.parse(left.createdAt) : 0;
        return rightDate - leftDate;
      })
      .slice(0, limit);

    return {
      results: combined,
      nextCursor: null,
    };
  }

  async searchMaterials(
    schoolId: string,
    query: SearchMaterialsDto,
  ): Promise<{ results: SearchResult[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;
    const searchTerm = `%${query.query.trim().toLowerCase()}%`;
    const params: Array<string | number> = [schoolId, searchTerm];
    const where: string[] = [
      'm.school_id = $1',
      'm.deleted_at IS NULL',
      `(
        lower(m.title) LIKE $2
        OR lower(coalesce(m.description, '')) LIKE $2
        OR EXISTS (
          SELECT 1
          FROM academic_material_tag_map atm2
          INNER JOIN material_tags mt2 ON mt2.id = atm2.tag_id
          WHERE atm2.material_id = m.id
            AND (
              lower(mt2.name) LIKE $2
              OR lower(mt2.slug) LIKE $2
            )
        )
      )`,
    ];

    if (query.departmentId) {
      params.push(query.departmentId);
      where.push(`m.department_id = $${params.length}`);
    }

    if (query.courseId) {
      params.push(query.courseId);
      where.push(`m.course_id = $${params.length}`);
    }

    const tagTerms = this.parseTags(query.tags);
    if (tagTerms.length > 0) {
      const tagPredicates: string[] = [];
      for (const tag of tagTerms) {
        params.push(`%${tag}%`);
        tagPredicates.push(
          `(lower(mt_filter.name) LIKE $${params.length} OR lower(mt_filter.slug) LIKE $${params.length})`,
        );
      }

      where.push(
        `EXISTS (
          SELECT 1
          FROM academic_material_tag_map atm_filter
          INNER JOIN material_tags mt_filter ON mt_filter.id = atm_filter.tag_id
          WHERE atm_filter.material_id = m.id
            AND (${tagPredicates.join(' OR ')})
        )`,
      );
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    const orderBy =
      query.sortBy === 'most_upvoted'
        ? 'm.vote_score DESC, m.created_at DESC'
        : 'm.created_at DESC';

    const result = await this.pool.query(
      `
        SELECT
          m.id,
          m.title,
          m.description,
          m.created_at,
          m.vote_score,
          COALESCE(
            (
              SELECT string_agg(DISTINCT mt.name, ', ' ORDER BY mt.name)
              FROM academic_material_tag_map atm
              INNER JOIN material_tags mt ON mt.id = atm.tag_id
              WHERE atm.material_id = m.id
            ),
            ''
          ) AS tag_preview,
          CASE
            WHEN lower(m.title) LIKE $2 THEN 3
            WHEN lower(coalesce(m.description, '')) LIKE $2 THEN 2
            ELSE 1
          END AS relevance_score
        FROM academic_materials m
        WHERE ${where.join('\n          AND ')}
        ORDER BY relevance_score DESC, ${orderBy}, m.id DESC
        LIMIT ${limitParam}
      `,
      params,
    );

    return {
      results: result.rows.map((row) => ({
        entityType: 'material',
        entityId: row.id,
        title: row.title,
        preview: this.pickMaterialPreview(row.description, row.tag_preview),
        relevanceScore: Number(row.relevance_score ?? 1),
        createdAt: this.toIso(row.created_at),
        metadata: {
          voteScore: Number(row.vote_score ?? 0),
        },
      })),
      nextCursor: null,
    };
  }

  async searchUsers(
    schoolId: string,
    query: SearchUsersDto,
  ): Promise<{ results: SearchResult[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;
    const searchTerm = `%${query.query.trim().toLowerCase()}%`;
    const result = await this.pool.query(
      `
        SELECT
          u.id,
          u.full_name,
          u.username,
          u.email,
          u.role,
          u.created_at,
          CASE
            WHEN lower(u.full_name) LIKE $2 THEN 3
            WHEN lower(coalesce(u.username, '')) LIKE $2 THEN 2
            ELSE 1
          END AS relevance_score
        FROM users u
        WHERE u.school_id = $1
          AND (
            lower(u.full_name) LIKE $2
            OR lower(u.email) LIKE $2
            OR lower(coalesce(u.username, '')) LIKE $2
          )
        ORDER BY relevance_score DESC, u.full_name ASC, u.id ASC
        LIMIT $3
      `,
      [schoolId, searchTerm, limit],
    );

    return {
      results: result.rows.map((row) => ({
        entityType: 'user',
        entityId: row.id,
        title: row.full_name,
        preview: row.username ? `@${row.username} • ${row.email}` : row.email,
        relevanceScore: Number(row.relevance_score ?? 1),
        createdAt: this.toIso(row.created_at),
        metadata: {
          role: row.role,
          username: row.username,
        },
      })),
      nextCursor: null,
    };
  }

  async searchGroups(
    schoolId: string,
    query: SearchGroupsDto,
  ): Promise<{ results: SearchResult[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;
    const searchTerm = `%${query.query.trim().toLowerCase()}%`;
    const result = await this.pool.query(
      `
        SELECT
          g.id,
          g.name,
          g.slug,
          g.description,
          g.visibility,
          g.created_at,
          CASE
            WHEN lower(g.name) LIKE $2 THEN 3
            WHEN lower(coalesce(g.description, '')) LIKE $2 THEN 2
            ELSE 1
          END AS relevance_score
        FROM groups g
        WHERE g.school_id = $1
          AND g.is_active = true
          AND (
            lower(g.name) LIKE $2
            OR lower(coalesce(g.slug, '')) LIKE $2
            OR lower(coalesce(g.description, '')) LIKE $2
          )
        ORDER BY relevance_score DESC, g.created_at DESC, g.id DESC
        LIMIT $3
      `,
      [schoolId, searchTerm, limit],
    );

    return {
      results: result.rows.map((row) => ({
        entityType: 'group',
        entityId: row.id,
        title: row.name,
        preview: row.description ?? '',
        relevanceScore: Number(row.relevance_score ?? 1),
        createdAt: this.toIso(row.created_at),
        metadata: {
          slug: row.slug,
          visibility: row.visibility,
        },
      })),
      nextCursor: null,
    };
  }

  private parseTags(tags?: string): string[] {
    if (!tags) {
      return [];
    }

    return [...new Set(tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  }

  private pickMaterialPreview(description: string | null, tagPreview: string | null): string {
    if (description && description.trim().length > 0) {
      return description;
    }

    if (tagPreview && tagPreview.trim().length > 0) {
      return `Tags: ${tagPreview}`;
    }

    return 'No preview available';
  }

  private toIso(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(String(value)).toISOString();
  }
}
