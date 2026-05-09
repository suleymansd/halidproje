"""courses table for academic materials and course module

Revision ID: 20260430_0005
Revises: 20260325_0004
Create Date: 2026-04-30 00:00:00.000000
"""

from alembic import op


revision = "20260430_0005"
down_revision = "20260325_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS courses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            department_id uuid NULL REFERENCES departments(id) ON DELETE SET NULL,
            code varchar(50) NOT NULL,
            name varchar(200) NOT NULL,
            description text NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_courses_school_code UNIQUE (school_id, code)
        );

        CREATE INDEX IF NOT EXISTS idx_courses_school_department
            ON courses (school_id, department_id);

        CREATE INDEX IF NOT EXISTS idx_courses_school_is_active
            ON courses (school_id, is_active);

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_academic_materials_course_id'
                  AND table_name = 'academic_materials'
            ) THEN
                ALTER TABLE academic_materials
                    ADD CONSTRAINT fk_academic_materials_course_id
                    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
            END IF;
        END
        $$;

        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS set_updated_at_courses ON courses;
        CREATE TRIGGER set_updated_at_courses
        BEFORE UPDATE ON courses
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at_courses ON courses;

        ALTER TABLE academic_materials
            DROP CONSTRAINT IF EXISTS fk_academic_materials_course_id;

        DROP INDEX IF EXISTS idx_courses_school_is_active;
        DROP INDEX IF EXISTS idx_courses_school_department;

        DROP TABLE IF EXISTS courses;
        """
    )
