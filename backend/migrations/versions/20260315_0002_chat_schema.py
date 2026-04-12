"""chat schema

Revision ID: 20260315_0002
Revises:
Create Date: 2026-03-15 00:00:00.000000

This migration must run after the core schema migration that creates:
- schools
- departments
- users
- groups
"""

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "20260315_0002"
down_revision = "20260315_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    users_exists = bind.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'users'
            )
            """
        )
    ).scalar()

    if not users_exists:
        return

    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_room_type') THEN
                CREATE TYPE chat_room_type AS ENUM ('general', 'department', 'private', 'group');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_room_member_role') THEN
                CREATE TYPE chat_room_member_role AS ENUM ('member', 'admin', 'owner');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_type') THEN
                CREATE TYPE chat_message_type AS ENUM ('text', 'attachment', 'system');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_attachment_type') THEN
                CREATE TYPE chat_attachment_type AS ENUM ('image', 'file', 'video', 'audio', 'other');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_report_status') THEN
                CREATE TYPE chat_report_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed');
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_report_reason') THEN
                CREATE TYPE chat_report_reason AS ENUM (
                    'spam',
                    'harassment',
                    'hate_speech',
                    'inappropriate_content',
                    'copyright',
                    'misinformation',
                    'other'
                );
            END IF;
        END
        $$;

        CREATE TABLE IF NOT EXISTS chat_rooms (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            room_type chat_room_type NOT NULL,
            department_id uuid NULL REFERENCES departments(id) ON DELETE RESTRICT,
            group_id uuid NULL REFERENCES groups(id) ON DELETE RESTRICT,
            created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
            dm_user_low_id uuid NULL REFERENCES users(id) ON DELETE RESTRICT,
            dm_user_high_id uuid NULL REFERENCES users(id) ON DELETE RESTRICT,
            name varchar(200) NULL,
            description text NULL,
            avatar_url text NULL,
            is_active boolean NOT NULL DEFAULT true,
            is_archived boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            archived_at timestamptz NULL,
            CONSTRAINT chk_chat_rooms_department_scope CHECK (
                (room_type = 'department' AND department_id IS NOT NULL AND group_id IS NULL AND dm_user_low_id IS NULL AND dm_user_high_id IS NULL)
                OR
                (room_type = 'group' AND group_id IS NOT NULL AND department_id IS NULL AND dm_user_low_id IS NULL AND dm_user_high_id IS NULL)
                OR
                (room_type = 'private' AND department_id IS NULL AND group_id IS NULL AND dm_user_low_id IS NOT NULL AND dm_user_high_id IS NOT NULL)
                OR
                (room_type = 'general' AND department_id IS NULL AND group_id IS NULL AND dm_user_low_id IS NULL AND dm_user_high_id IS NULL)
            ),
            CONSTRAINT chk_chat_rooms_dm_pair_order CHECK (
                room_type <> 'private'
                OR (
                    dm_user_low_id IS NOT NULL
                    AND dm_user_high_id IS NOT NULL
                    AND dm_user_low_id <> dm_user_high_id
                    AND dm_user_low_id::text < dm_user_high_id::text
                )
            ),
            CONSTRAINT chk_chat_rooms_archive_consistency CHECK (
                (is_archived = false AND archived_at IS NULL)
                OR
                (is_archived = true AND archived_at IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS chat_room_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            room_role chat_room_member_role NOT NULL DEFAULT 'member',
            is_active boolean NOT NULL DEFAULT true,
            joined_at timestamptz NOT NULL DEFAULT now(),
            left_at timestamptz NULL,
            mute_until timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_chat_room_members_room_user UNIQUE (room_id, user_id),
            CONSTRAINT chk_chat_room_members_left_state CHECK (
                (is_active = true AND left_at IS NULL)
                OR
                (is_active = false AND left_at IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
            sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            message_type chat_message_type NOT NULL DEFAULT 'text',
            content text NULL,
            reply_to_message_id uuid NULL REFERENCES messages(id) ON DELETE SET NULL,
            is_edited boolean NOT NULL DEFAULT false,
            edited_at timestamptz NULL,
            is_deleted boolean NOT NULL DEFAULT false,
            deleted_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT chk_messages_content_required CHECK (
                (message_type = 'text' AND content IS NOT NULL AND btrim(content) <> '')
                OR
                (message_type IN ('attachment', 'system'))
            ),
            CONSTRAINT chk_messages_edit_state CHECK (
                (is_edited = false AND edited_at IS NULL)
                OR
                (is_edited = true AND edited_at IS NOT NULL)
            ),
            CONSTRAINT chk_messages_delete_state CHECK (
                (is_deleted = false AND deleted_at IS NULL)
                OR
                (is_deleted = true AND deleted_at IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS message_attachments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            attachment_type chat_attachment_type NOT NULL,
            storage_url text NOT NULL,
            filename varchar(255) NOT NULL,
            mime_type varchar(150) NOT NULL,
            file_size_bytes bigint NOT NULL,
            thumbnail_url text NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT chk_message_attachments_size_positive CHECK (file_size_bytes > 0)
        );

        CREATE TABLE IF NOT EXISTS message_reactions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reaction_type varchar(32) NOT NULL,
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_message_reactions_message_user_reaction UNIQUE (message_id, user_id, reaction_type),
            CONSTRAINT chk_message_reactions_type_not_blank CHECK (btrim(reaction_type) <> '')
        );

        CREATE TABLE IF NOT EXISTS message_read_states (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            last_read_message_id uuid NULL REFERENCES messages(id) ON DELETE SET NULL,
            last_read_at timestamptz NOT NULL DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_message_read_states_room_user UNIQUE (room_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS message_reports (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason chat_report_reason NOT NULL,
            description text NULL,
            status chat_report_status NOT NULL DEFAULT 'open',
            reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_message_reports_message_reporter UNIQUE (message_id, reporter_id),
            CONSTRAINT chk_message_reports_review_state CHECK (
                (status IN ('open', 'under_review') AND reviewed_at IS NULL AND reviewed_by IS NULL)
                OR
                (status IN ('resolved', 'dismissed') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
            )
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_general_per_school_active
            ON chat_rooms (school_id)
            WHERE room_type = 'general' AND is_archived = false;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_department_per_department_active
            ON chat_rooms (department_id)
            WHERE room_type = 'department' AND is_archived = false;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_group_per_group_active
            ON chat_rooms (group_id)
            WHERE room_type = 'group' AND is_archived = false;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_private_pair_per_school_active
            ON chat_rooms (school_id, dm_user_low_id, dm_user_high_id)
            WHERE room_type = 'private' AND is_archived = false;

        CREATE INDEX IF NOT EXISTS idx_chat_rooms_school_type_active
            ON chat_rooms (school_id, room_type, is_active, is_archived, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by
            ON chat_rooms (school_id, created_by)
            WHERE created_by IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_active
            ON chat_room_members (school_id, user_id, is_active, joined_at DESC);

        CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_active
            ON chat_room_members (room_id, is_active, joined_at DESC);

        CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_role
            ON chat_room_members (room_id, room_role)
            WHERE is_active = true;

        CREATE INDEX IF NOT EXISTS idx_messages_room_created_desc
            ON messages (school_id, room_id, created_at DESC, id DESC);

        CREATE INDEX IF NOT EXISTS idx_messages_room_not_deleted_created_desc
            ON messages (school_id, room_id, created_at DESC, id DESC)
            WHERE is_deleted = false;

        CREATE INDEX IF NOT EXISTS idx_messages_reply_to
            ON messages (reply_to_message_id)
            WHERE reply_to_message_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_messages_sender_created_desc
            ON messages (school_id, sender_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_attachments_message
            ON message_attachments (message_id);

        CREATE INDEX IF NOT EXISTS idx_message_attachments_school_message
            ON message_attachments (school_id, message_id);

        CREATE INDEX IF NOT EXISTS idx_message_reactions_message
            ON message_reactions (message_id, created_at ASC);

        CREATE INDEX IF NOT EXISTS idx_message_reactions_user
            ON message_reactions (school_id, user_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_read_states_user
            ON message_read_states (school_id, user_id, last_read_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_read_states_room
            ON message_read_states (room_id, last_read_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_reports_status_created
            ON message_reports (school_id, status, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_reports_message
            ON message_reports (message_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_reports_reporter
            ON message_reports (school_id, reporter_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_message_reports_reviewed_by
            ON message_reports (school_id, reviewed_by, reviewed_at DESC)
            WHERE reviewed_by IS NOT NULL;

        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS set_updated_at_chat_rooms ON chat_rooms;
        CREATE TRIGGER set_updated_at_chat_rooms
        BEFORE UPDATE ON chat_rooms
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_chat_room_members ON chat_room_members;
        CREATE TRIGGER set_updated_at_chat_room_members
        BEFORE UPDATE ON chat_room_members
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_messages ON messages;
        CREATE TRIGGER set_updated_at_messages
        BEFORE UPDATE ON messages
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_message_attachments ON message_attachments;
        CREATE TRIGGER set_updated_at_message_attachments
        BEFORE UPDATE ON message_attachments
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_message_reactions ON message_reactions;
        CREATE TRIGGER set_updated_at_message_reactions
        BEFORE UPDATE ON message_reactions
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_message_read_states ON message_read_states;
        CREATE TRIGGER set_updated_at_message_read_states
        BEFORE UPDATE ON message_read_states
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_message_reports ON message_reports;
        CREATE TRIGGER set_updated_at_message_reports
        BEFORE UPDATE ON message_reports
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        CREATE OR REPLACE FUNCTION trg_validate_private_room_member()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        DECLARE
            room_type_value chat_room_type;
            active_member_count integer;
        BEGIN
            SELECT room_type
            INTO room_type_value
            FROM chat_rooms
            WHERE id = COALESCE(NEW.room_id, OLD.room_id);

            IF room_type_value IS NULL THEN
                RETURN COALESCE(NEW, OLD);
            END IF;

            IF room_type_value = 'private' THEN
                SELECT count(*)
                INTO active_member_count
                FROM chat_room_members
                WHERE room_id = COALESCE(NEW.room_id, OLD.room_id)
                  AND is_active = true;

                IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_active = true AND active_member_count > 2 THEN
                    RAISE EXCEPTION 'private rooms may not have more than two active members';
                END IF;
            END IF;

            RETURN COALESCE(NEW, OLD);
        END;
        $fn$;

        DROP TRIGGER IF EXISTS validate_private_room_member_insert ON chat_room_members;
        CREATE CONSTRAINT TRIGGER validate_private_room_member_insert
        AFTER INSERT ON chat_room_members
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION trg_validate_private_room_member();

        DROP TRIGGER IF EXISTS validate_private_room_member_update ON chat_room_members;
        CREATE CONSTRAINT TRIGGER validate_private_room_member_update
        AFTER UPDATE OF is_active, room_id ON chat_room_members
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION trg_validate_private_room_member();

        CREATE OR REPLACE FUNCTION trg_validate_message_read_state_room()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $fn$
        DECLARE
            message_room_id uuid;
        BEGIN
            IF NEW.last_read_message_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT room_id
            INTO message_room_id
            FROM messages
            WHERE id = NEW.last_read_message_id;

            IF message_room_id IS NULL THEN
                RAISE EXCEPTION 'last_read_message_id does not reference an existing message';
            END IF;

            IF message_room_id <> NEW.room_id THEN
                RAISE EXCEPTION 'last_read_message_id must belong to the same room';
            END IF;

            RETURN NEW;
        END;
        $fn$;

        DROP TRIGGER IF EXISTS validate_message_read_state_room ON message_read_states;
        CREATE TRIGGER validate_message_read_state_room
        BEFORE INSERT OR UPDATE OF last_read_message_id, room_id ON message_read_states
        FOR EACH ROW
        EXECUTE FUNCTION trg_validate_message_read_state_room();
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    users_exists = bind.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'users'
            )
            """
        )
    ).scalar()

    if not users_exists:
        return

    op.execute(
        """
        DROP TRIGGER IF EXISTS validate_message_read_state_room ON message_read_states;
        DROP TRIGGER IF EXISTS validate_private_room_member_update ON chat_room_members;
        DROP TRIGGER IF EXISTS validate_private_room_member_insert ON chat_room_members;
        DROP TRIGGER IF EXISTS set_updated_at_message_reports ON message_reports;
        DROP TRIGGER IF EXISTS set_updated_at_message_read_states ON message_read_states;
        DROP TRIGGER IF EXISTS set_updated_at_message_reactions ON message_reactions;
        DROP TRIGGER IF EXISTS set_updated_at_message_attachments ON message_attachments;
        DROP TRIGGER IF EXISTS set_updated_at_messages ON messages;
        DROP TRIGGER IF EXISTS set_updated_at_chat_room_members ON chat_room_members;
        DROP TRIGGER IF EXISTS set_updated_at_chat_rooms ON chat_rooms;

        DROP FUNCTION IF EXISTS trg_validate_message_read_state_room();
        DROP FUNCTION IF EXISTS trg_validate_private_room_member();
        DROP FUNCTION IF EXISTS trg_set_updated_at();

        DROP TABLE IF EXISTS message_reports;
        DROP TABLE IF EXISTS message_read_states;
        DROP TABLE IF EXISTS message_reactions;
        DROP TABLE IF EXISTS message_attachments;
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS chat_room_members;
        DROP TABLE IF EXISTS chat_rooms;

        DROP TYPE IF EXISTS chat_report_reason;
        DROP TYPE IF EXISTS chat_report_status;
        DROP TYPE IF EXISTS chat_attachment_type;
        DROP TYPE IF EXISTS chat_message_type;
        DROP TYPE IF EXISTS chat_room_member_role;
        DROP TYPE IF EXISTS chat_room_type;
        """
    )
