"""academic materials schema

Revision ID: 20260325_0004
Revises: 20260324_0003
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op


revision = "20260325_0004"
down_revision = "20260324_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS academic_materials (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            uploader_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            department_id uuid NULL REFERENCES departments(id) ON DELETE SET NULL,
            course_id uuid NULL,
            title varchar(250) NOT NULL,
            description text NULL,
            material_type varchar(50) NOT NULL,
            download_count integer NOT NULL DEFAULT 0,
            comment_count integer NOT NULL DEFAULT 0,
            vote_score integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz NULL
        );

        CREATE TABLE IF NOT EXISTS material_files (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            storage_url text NOT NULL,
            filename varchar(255) NOT NULL,
            file_type varchar(150) NOT NULL,
            file_size bigint NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS material_tags (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            name varchar(60) NOT NULL,
            slug varchar(80) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_material_tags_school_slug UNIQUE (school_id, slug)
        );

        CREATE TABLE IF NOT EXISTS academic_material_tag_map (
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            tag_id uuid NOT NULL REFERENCES material_tags(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (material_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS material_comments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            parent_comment_id uuid NULL REFERENCES material_comments(id) ON DELETE CASCADE,
            body text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz NULL
        );

        CREATE TABLE IF NOT EXISTS material_votes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vote smallint NOT NULL CHECK (vote IN (-1, 1)),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_material_votes_material_user UNIQUE (material_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS material_bookmarks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            note varchar(120) NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_material_bookmarks_material_user UNIQUE (material_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS material_reports (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            material_id uuid NOT NULL REFERENCES academic_materials(id) ON DELETE CASCADE,
            reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason varchar(64) NOT NULL,
            description text NULL,
            status varchar(32) NOT NULL DEFAULT 'open',
            reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_material_reports_material_reporter UNIQUE (material_id, reporter_id)
        );

        CREATE INDEX IF NOT EXISTS idx_academic_materials_school_created
            ON academic_materials (school_id, created_at DESC, id DESC);

        CREATE INDEX IF NOT EXISTS idx_academic_materials_school_department
            ON academic_materials (school_id, department_id, created_at DESC)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_academic_materials_school_course
            ON academic_materials (school_id, course_id, created_at DESC)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_academic_materials_school_vote
            ON academic_materials (school_id, vote_score DESC, created_at DESC)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_material_files_material
            ON material_files (material_id, created_at ASC);

        CREATE INDEX IF NOT EXISTS idx_material_comments_material
            ON material_comments (material_id, created_at ASC)
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_material_reports_school_status
            ON material_reports (school_id, status, created_at DESC);

        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS set_updated_at_academic_materials ON academic_materials;
        CREATE TRIGGER set_updated_at_academic_materials
        BEFORE UPDATE ON academic_materials
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_material_files ON material_files;
        CREATE TRIGGER set_updated_at_material_files
        BEFORE UPDATE ON material_files
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_material_comments ON material_comments;
        CREATE TRIGGER set_updated_at_material_comments
        BEFORE UPDATE ON material_comments
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_material_votes ON material_votes;
        CREATE TRIGGER set_updated_at_material_votes
        BEFORE UPDATE ON material_votes
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_material_bookmarks ON material_bookmarks;
        CREATE TRIGGER set_updated_at_material_bookmarks
        BEFORE UPDATE ON material_bookmarks
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_material_reports ON material_reports;
        CREATE TRIGGER set_updated_at_material_reports
        BEFORE UPDATE ON material_reports
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at_material_reports ON material_reports;
        DROP TRIGGER IF EXISTS set_updated_at_material_bookmarks ON material_bookmarks;
        DROP TRIGGER IF EXISTS set_updated_at_material_votes ON material_votes;
        DROP TRIGGER IF EXISTS set_updated_at_material_comments ON material_comments;
        DROP TRIGGER IF EXISTS set_updated_at_material_files ON material_files;
        DROP TRIGGER IF EXISTS set_updated_at_academic_materials ON academic_materials;

        DROP INDEX IF EXISTS idx_material_reports_school_status;
        DROP INDEX IF EXISTS idx_material_comments_material;
        DROP INDEX IF EXISTS idx_material_files_material;
        DROP INDEX IF EXISTS idx_academic_materials_school_vote;
        DROP INDEX IF EXISTS idx_academic_materials_school_course;
        DROP INDEX IF EXISTS idx_academic_materials_school_department;
        DROP INDEX IF EXISTS idx_academic_materials_school_created;

        DROP TABLE IF EXISTS material_reports;
        DROP TABLE IF EXISTS material_bookmarks;
        DROP TABLE IF EXISTS material_votes;
        DROP TABLE IF EXISTS material_comments;
        DROP TABLE IF EXISTS academic_material_tag_map;
        DROP TABLE IF EXISTS material_tags;
        DROP TABLE IF EXISTS material_files;
        DROP TABLE IF EXISTS academic_materials;
        """
    )
