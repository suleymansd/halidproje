"""roles table for local bootstrap and seed data

Revision ID: 20260324_0003
Revises: 20260315_0002
Create Date: 2026-03-24 00:00:00.000000
"""

from alembic import op


revision = "20260324_0003"
down_revision = "20260315_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name varchar(50) NOT NULL UNIQUE,
            description text NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS set_updated_at_roles ON roles;
        CREATE TRIGGER set_updated_at_roles
        BEFORE UPDATE ON roles
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at_roles ON roles;
        DROP TABLE IF EXISTS roles;
        """
    )
