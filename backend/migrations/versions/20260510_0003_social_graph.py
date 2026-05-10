"""social graph tables

Revision ID: 20260510_0003
Revises: 20260430_0005
Create Date: 2026-05-10 00:00:00.000000
"""

from alembic import op


revision = "20260510_0003"
down_revision = "20260430_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS friend_requests (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status varchar(32) NOT NULL DEFAULT 'pending',
            responded_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT chk_friend_requests_distinct_users CHECK (requester_id <> recipient_id),
            CONSTRAINT uq_friend_requests_pair UNIQUE (school_id, requester_id, recipient_id)
        );

        CREATE TABLE IF NOT EXISTS user_follows (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT chk_user_follows_distinct_users CHECK (follower_id <> followee_id),
            CONSTRAINT uq_user_follows_pair UNIQUE (school_id, follower_id, followee_id)
        );

        CREATE TABLE IF NOT EXISTS user_blocks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
            blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT chk_user_blocks_distinct_users CHECK (blocker_id <> blocked_id),
            CONSTRAINT uq_user_blocks_pair UNIQUE (school_id, blocker_id, blocked_id)
        );

        CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_id
            ON friend_requests (requester_id);
        CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_id
            ON friend_requests (recipient_id);
        CREATE INDEX IF NOT EXISTS idx_friend_requests_status
            ON friend_requests (status);

        CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id
            ON user_follows (follower_id);
        CREATE INDEX IF NOT EXISTS idx_user_follows_followee_id
            ON user_follows (followee_id);

        CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id
            ON user_blocks (blocker_id);
        CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id
            ON user_blocks (blocked_id);

        DROP TRIGGER IF EXISTS set_updated_at_friend_requests ON friend_requests;
        CREATE TRIGGER set_updated_at_friend_requests
        BEFORE UPDATE ON friend_requests
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_user_follows ON user_follows;
        CREATE TRIGGER set_updated_at_user_follows
        BEFORE UPDATE ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();

        DROP TRIGGER IF EXISTS set_updated_at_user_blocks ON user_blocks;
        CREATE TRIGGER set_updated_at_user_blocks
        BEFORE UPDATE ON user_blocks
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_updated_at_user_blocks ON user_blocks;
        DROP TRIGGER IF EXISTS set_updated_at_user_follows ON user_follows;
        DROP TRIGGER IF EXISTS set_updated_at_friend_requests ON friend_requests;

        DROP INDEX IF EXISTS idx_user_blocks_blocked_id;
        DROP INDEX IF EXISTS idx_user_blocks_blocker_id;
        DROP INDEX IF EXISTS idx_user_follows_followee_id;
        DROP INDEX IF EXISTS idx_user_follows_follower_id;
        DROP INDEX IF EXISTS idx_friend_requests_status;
        DROP INDEX IF EXISTS idx_friend_requests_recipient_id;
        DROP INDEX IF EXISTS idx_friend_requests_requester_id;

        DROP TABLE IF EXISTS user_blocks;
        DROP TABLE IF EXISTS user_follows;
        DROP TABLE IF EXISTS friend_requests;
        """
    )
