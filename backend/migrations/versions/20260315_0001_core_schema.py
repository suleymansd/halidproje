"""core schema for chat dependencies

TODO: If this repository later gains an earlier non-chat Alembic base revision, revisit down_revision.

Revision ID: 20260315_0001
Revises:
Create Date: 2026-03-15 00:00:00.000000
"""

from alembic import op


revision = "20260315_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        CREATE TABLE IF NOT EXISTS schools (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name varchar(200) NOT NULL,
            slug varchar(120) NOT NULL UNIQUE,
            status varchar(32) NOT NULL DEFAULT 'active',
            timezone varchar(64) NOT NULL DEFAULT 'UTC',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS departments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            name varchar(200) NOT NULL,
            code varchar(50) NULL,
            description text NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_departments_school_name UNIQUE (school_id, name),
            CONSTRAINT uq_departments_school_code UNIQUE (school_id, code)
        );

        CREATE TABLE IF NOT EXISTS users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
            department_id uuid NULL REFERENCES departments(id) ON DELETE SET NULL,
            email varchar(255) NOT NULL UNIQUE,
            username varchar(50) NULL UNIQUE,
            full_name varchar(200) NOT NULL,
            password_hash varchar(255) NOT NULL,
            role varchar(32) NOT NULL DEFAULT 'student',
            status varchar(32) NOT NULL DEFAULT 'active',
            bio text NULL,
            onboarding_completed boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS groups (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            owner_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
            name varchar(150) NOT NULL,
            slug varchar(160) NULL,
            description text NULL,
            visibility varchar(32) NOT NULL DEFAULT 'private',
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            refresh_token_hash text NOT NULL,
            expires_at timestamptz NOT NULL,
            revoked_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_departments_school_id
            ON departments (school_id);

        CREATE INDEX IF NOT EXISTS idx_groups_school_id
            ON groups (school_id);

        CREATE INDEX IF NOT EXISTS idx_users_school_id
            ON users (school_id);

        CREATE INDEX IF NOT EXISTS idx_users_department_id
            ON users (department_id);

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
            ON user_sessions (user_id);

        CREATE INDEX IF NOT EXISTS idx_user_sessions_school_id
            ON user_sessions (school_id);

        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
            ON user_sessions (expires_at);

        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS set_updated_at_schools ON schools;
        CREATE TRIGGER set_updated_at_schools
        BEFORE UPDATE ON schools
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_departments ON departments;
        CREATE TRIGGER set_updated_at_departments
        BEFORE UPDATE ON departments
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_users ON users;
        CREATE TRIGGER set_updated_at_users
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_groups ON groups;
        CREATE TRIGGER set_updated_at_groups
        BEFORE UPDATE ON groups
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_user_sessions ON user_sessions;
        CREATE TRIGGER set_updated_at_user_sessions
        BEFORE UPDATE ON user_sessions
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at_user_sessions ON user_sessions;
        DROP TRIGGER IF EXISTS set_updated_at_groups ON groups;
        DROP TRIGGER IF EXISTS set_updated_at_users ON users;
        DROP TRIGGER IF EXISTS set_updated_at_departments ON departments;
        DROP TRIGGER IF EXISTS set_updated_at_schools ON schools;

        DROP FUNCTION IF EXISTS trg_set_updated_at();

        DROP INDEX IF EXISTS idx_user_sessions_expires_at;
        DROP INDEX IF EXISTS idx_user_sessions_school_id;
        DROP INDEX IF EXISTS idx_user_sessions_user_id;
        DROP INDEX IF EXISTS idx_users_department_id;
        DROP INDEX IF EXISTS idx_users_school_id;
        DROP INDEX IF EXISTS idx_groups_school_id;
        DROP INDEX IF EXISTS idx_departments_school_id;

        DROP TABLE IF EXISTS user_sessions;
        DROP TABLE IF EXISTS groups;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS departments;
        DROP TABLE IF EXISTS schools;
        """
    )
