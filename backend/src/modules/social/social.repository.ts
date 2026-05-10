import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { DATABASE_POOL } from '../../infrastructure/database/database.constants';

type SocialUserRow = {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  department_id: string | null;
  department_name: string | null;
  role: string;
};

@Injectable()
export class SocialRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findUserById(schoolId: string, userId: string) {
    const result = await this.pool.query(
      `
        SELECT
          u.id,
          u.full_name,
          u.username,
          u.email,
          u.department_id,
          d.name AS department_name,
          u.role
        FROM users u
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.school_id = $1
          AND u.id = $2
        LIMIT 1
      `,
      [schoolId, userId],
    );

    return result.rowCount ? this.mapUser(result.rows[0]) : null;
  }

  async listFriends(schoolId: string, userId: string) {
    const [friends, incoming, outgoing] = await Promise.all([
      this.pool.query(
        `
          SELECT
            fr.id AS request_id,
            fr.created_at,
            CASE
              WHEN fr.requester_id = $2 THEN recipient.id
              ELSE requester.id
            END AS user_id,
            CASE
              WHEN fr.requester_id = $2 THEN recipient.full_name
              ELSE requester.full_name
            END AS full_name,
            CASE
              WHEN fr.requester_id = $2 THEN recipient.username
              ELSE requester.username
            END AS username,
            CASE
              WHEN fr.requester_id = $2 THEN recipient.email
              ELSE requester.email
            END AS email,
            CASE
              WHEN fr.requester_id = $2 THEN recipient.department_id
              ELSE requester.department_id
            END AS department_id,
            CASE
              WHEN fr.requester_id = $2 THEN recipient_department.name
              ELSE requester_department.name
            END AS department_name
          FROM friend_requests fr
          INNER JOIN users requester ON requester.id = fr.requester_id
          INNER JOIN users recipient ON recipient.id = fr.recipient_id
          LEFT JOIN departments requester_department ON requester_department.id = requester.department_id
          LEFT JOIN departments recipient_department ON recipient_department.id = recipient.department_id
          WHERE fr.school_id = $1
            AND fr.status = 'accepted'
            AND (fr.requester_id = $2 OR fr.recipient_id = $2)
          ORDER BY fr.updated_at DESC, fr.created_at DESC
        `,
        [schoolId, userId],
      ),
      this.pool.query(
        `
          SELECT
            fr.id,
            fr.created_at,
            requester.id AS user_id,
            requester.full_name,
            requester.username,
            requester.email,
            requester.department_id,
            dept.name AS department_name
          FROM friend_requests fr
          INNER JOIN users requester ON requester.id = fr.requester_id
          LEFT JOIN departments dept ON dept.id = requester.department_id
          WHERE fr.school_id = $1
            AND fr.recipient_id = $2
            AND fr.status = 'pending'
          ORDER BY fr.created_at DESC
        `,
        [schoolId, userId],
      ),
      this.pool.query(
        `
          SELECT
            fr.id,
            fr.created_at,
            recipient.id AS user_id,
            recipient.full_name,
            recipient.username,
            recipient.email,
            recipient.department_id,
            dept.name AS department_name
          FROM friend_requests fr
          INNER JOIN users recipient ON recipient.id = fr.recipient_id
          LEFT JOIN departments dept ON dept.id = recipient.department_id
          WHERE fr.school_id = $1
            AND fr.requester_id = $2
            AND fr.status = 'pending'
          ORDER BY fr.created_at DESC
        `,
        [schoolId, userId],
      ),
    ]);

    return {
      friends: friends.rows.map((row) => ({
        requestId: row.request_id,
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
      incomingRequests: incoming.rows.map((row) => ({
        requestId: row.id,
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
      outgoingRequests: outgoing.rows.map((row) => ({
        requestId: row.id,
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
    };
  }

  async findFriendRequestBetweenUsers(schoolId: string, requesterId: string, recipientId: string) {
    const result = await this.pool.query(
      `
        SELECT id, requester_id, recipient_id, status
        FROM friend_requests
        WHERE school_id = $1
          AND (
            (requester_id = $2 AND recipient_id = $3)
            OR (requester_id = $3 AND recipient_id = $2)
          )
        LIMIT 1
      `,
      [schoolId, requesterId, recipientId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async upsertFriendRequest(schoolId: string, requesterId: string, recipientId: string) {
    const result = await this.pool.query(
      `
        INSERT INTO friend_requests (
          school_id,
          requester_id,
          recipient_id,
          status,
          responded_at
        )
        VALUES ($1, $2, $3, 'pending', NULL)
        ON CONFLICT (school_id, requester_id, recipient_id)
        DO UPDATE SET
          status = 'pending',
          responded_at = NULL,
          updated_at = now()
        RETURNING id, requester_id, recipient_id, status, created_at
      `,
      [schoolId, requesterId, recipientId],
    );

    return result.rows[0];
  }

  async findFriendRequestById(schoolId: string, requestId: string) {
    const result = await this.pool.query(
      `
        SELECT id, requester_id, recipient_id, status
        FROM friend_requests
        WHERE school_id = $1
          AND id = $2
        LIMIT 1
      `,
      [schoolId, requestId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async respondToFriendRequest(
    schoolId: string,
    requestId: string,
    status: 'accepted' | 'rejected',
  ) {
    const result = await this.pool.query(
      `
        UPDATE friend_requests
        SET
          status = $3,
          responded_at = now(),
          updated_at = now()
        WHERE school_id = $1
          AND id = $2
        RETURNING id, requester_id, recipient_id, status, responded_at
      `,
      [schoolId, requestId, status],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async listFollows(schoolId: string, userId: string) {
    const [following, followers] = await Promise.all([
      this.pool.query(
        `
          SELECT
            followed.id AS user_id,
            followed.full_name,
            followed.username,
            followed.email,
            followed.department_id,
            dept.name AS department_name,
            uf.created_at
          FROM user_follows uf
          INNER JOIN users followed ON followed.id = uf.followee_id
          LEFT JOIN departments dept ON dept.id = followed.department_id
          WHERE uf.school_id = $1
            AND uf.follower_id = $2
          ORDER BY uf.created_at DESC
        `,
        [schoolId, userId],
      ),
      this.pool.query(
        `
          SELECT
            follower.id AS user_id,
            follower.full_name,
            follower.username,
            follower.email,
            follower.department_id,
            dept.name AS department_name,
            uf.created_at
          FROM user_follows uf
          INNER JOIN users follower ON follower.id = uf.follower_id
          LEFT JOIN departments dept ON dept.id = follower.department_id
          WHERE uf.school_id = $1
            AND uf.followee_id = $2
          ORDER BY uf.created_at DESC
        `,
        [schoolId, userId],
      ),
    ]);

    return {
      following: following.rows.map((row) => ({
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
      followers: followers.rows.map((row) => ({
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
    };
  }

  async createFollow(schoolId: string, followerId: string, followeeId: string) {
    const result = await this.pool.query(
      `
        INSERT INTO user_follows (school_id, follower_id, followee_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (school_id, follower_id, followee_id)
        DO NOTHING
        RETURNING id
      `,
      [schoolId, followerId, followeeId],
    );

    return { created: result.rowCount > 0 };
  }

  async removeFollow(schoolId: string, followerId: string, followeeId: string) {
    const result = await this.pool.query(
      `
        DELETE FROM user_follows
        WHERE school_id = $1
          AND follower_id = $2
          AND followee_id = $3
      `,
      [schoolId, followerId, followeeId],
    );

    return { removed: result.rowCount > 0 };
  }

  async listBlocks(schoolId: string, userId: string) {
    const result = await this.pool.query(
      `
        SELECT
          blocked.id AS user_id,
          blocked.full_name,
          blocked.username,
          blocked.email,
          blocked.department_id,
          dept.name AS department_name,
          ub.created_at
        FROM user_blocks ub
        INNER JOIN users blocked ON blocked.id = ub.blocked_id
        LEFT JOIN departments dept ON dept.id = blocked.department_id
        WHERE ub.school_id = $1
          AND ub.blocker_id = $2
        ORDER BY ub.created_at DESC
      `,
      [schoolId, userId],
    );

    return {
      items: result.rows.map((row) => ({
        createdAt: row.created_at,
        user: this.mapUser(row),
      })),
    };
  }

  async createBlock(schoolId: string, blockerId: string, blockedId: string) {
    await this.pool.query(
      `
        INSERT INTO user_blocks (school_id, blocker_id, blocked_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (school_id, blocker_id, blocked_id)
        DO NOTHING
      `,
      [schoolId, blockerId, blockedId],
    );

    await this.pool.query(
      `
        DELETE FROM user_follows
        WHERE school_id = $1
          AND (
            (follower_id = $2 AND followee_id = $3)
            OR (follower_id = $3 AND followee_id = $2)
          )
      `,
      [schoolId, blockerId, blockedId],
    );

    await this.pool.query(
      `
        UPDATE friend_requests
        SET
          status = 'rejected',
          responded_at = now(),
          updated_at = now()
        WHERE school_id = $1
          AND status = 'pending'
          AND (
            (requester_id = $2 AND recipient_id = $3)
            OR (requester_id = $3 AND recipient_id = $2)
          )
      `,
      [schoolId, blockerId, blockedId],
    );

    return { blocked: true };
  }

  async removeBlock(schoolId: string, blockerId: string, blockedId: string) {
    const result = await this.pool.query(
      `
        DELETE FROM user_blocks
        WHERE school_id = $1
          AND blocker_id = $2
          AND blocked_id = $3
      `,
      [schoolId, blockerId, blockedId],
    );

    return { removed: result.rowCount > 0 };
  }

  async isBlockedBetweenUsers(schoolId: string, firstUserId: string, secondUserId: string) {
    const result = await this.pool.query(
      `
        SELECT blocker_id, blocked_id
        FROM user_blocks
        WHERE school_id = $1
          AND (
            (blocker_id = $2 AND blocked_id = $3)
            OR (blocker_id = $3 AND blocked_id = $2)
          )
        LIMIT 1
      `,
      [schoolId, firstUserId, secondUserId],
    );

    return result.rowCount ? result.rows[0] : null;
  }

  async getRelationshipState(schoolId: string, viewerUserId: string, targetUserId: string) {
    const [friendRequest, viewerFollowsTarget, targetFollowsViewer, viewerBlocksTarget, targetBlocksViewer, counts] =
      await Promise.all([
        this.findFriendRequestBetweenUsers(schoolId, viewerUserId, targetUserId),
        this.pool.query(
          `
            SELECT 1
            FROM user_follows
            WHERE school_id = $1
              AND follower_id = $2
              AND followee_id = $3
            LIMIT 1
          `,
          [schoolId, viewerUserId, targetUserId],
        ),
        this.pool.query(
          `
            SELECT 1
            FROM user_follows
            WHERE school_id = $1
              AND follower_id = $3
              AND followee_id = $2
            LIMIT 1
          `,
          [schoolId, viewerUserId, targetUserId],
        ),
        this.pool.query(
          `
            SELECT 1
            FROM user_blocks
            WHERE school_id = $1
              AND blocker_id = $2
              AND blocked_id = $3
            LIMIT 1
          `,
          [schoolId, viewerUserId, targetUserId],
        ),
        this.pool.query(
          `
            SELECT 1
            FROM user_blocks
            WHERE school_id = $1
              AND blocker_id = $3
              AND blocked_id = $2
            LIMIT 1
          `,
          [schoolId, viewerUserId, targetUserId],
        ),
        this.pool.query(
          `
            SELECT
              (SELECT COUNT(*) FROM user_follows WHERE school_id = $1 AND followee_id = $2) AS followers_count,
              (SELECT COUNT(*) FROM user_follows WHERE school_id = $1 AND follower_id = $2) AS following_count
          `,
          [schoolId, targetUserId],
        ),
      ]);

    let friendshipStatus = 'none';
    let friendRequestId: string | null = null;

    if (friendRequest) {
      friendRequestId = String(friendRequest.id);
      if (friendRequest.status === 'accepted') {
        friendshipStatus = 'friends';
      } else if (friendRequest.status === 'pending') {
        friendshipStatus =
          friendRequest.requester_id === viewerUserId
            ? 'outgoing_request'
            : 'incoming_request';
      }
    }

    return {
      friendshipStatus,
      friendRequestId,
      isFollowing: viewerFollowsTarget.rowCount > 0,
      isFollowedBy: targetFollowsViewer.rowCount > 0,
      isBlocked: viewerBlocksTarget.rowCount > 0,
      isBlockedBy: targetBlocksViewer.rowCount > 0,
      followersCount: Number(counts.rows[0]?.followers_count ?? 0),
      followingCount: Number(counts.rows[0]?.following_count ?? 0),
    };
  }

  private mapUser(row: SocialUserRow | Record<string, unknown>) {
    return {
      id: String((row as Record<string, unknown>).user_id ?? row.id),
      fullName: String((row as Record<string, unknown>).full_name),
      username:
        typeof (row as Record<string, unknown>).username === 'string'
          ? String((row as Record<string, unknown>).username)
          : null,
      email: String((row as Record<string, unknown>).email),
      role:
        typeof (row as Record<string, unknown>).role === 'string'
          ? String((row as Record<string, unknown>).role)
          : 'student',
      department:
        (row as Record<string, unknown>).department_id
          ? {
              id: String((row as Record<string, unknown>).department_id),
              name:
                typeof (row as Record<string, unknown>).department_name === 'string'
                  ? String((row as Record<string, unknown>).department_name)
                  : null,
            }
          : null,
    };
  }
}
