import { decodeCursor, toPage, type Page } from '@app/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, type EntityManager } from 'typeorm';
import { Follow } from './follow.entity.js';
import {
  canViewContent,
  relationshipOf,
  statusAfterFollow,
  type FollowStatus,
  type Relationship,
} from './follow-rules.js';

const PAGE_SIZE = 20;

export type ListKind = 'followers' | 'following' | 'requests';

// Which side of the follows row belongs to the profile, and which status the list shows.
const LISTS: Record<ListKind, { own: string; other: string; status: FollowStatus }> = {
  followers: { own: 'followee_id', other: 'follower_id', status: 'ACCEPTED' },
  following: { own: 'follower_id', other: 'followee_id', status: 'ACCEPTED' },
  requests: { own: 'followee_id', other: 'follower_id', status: 'PENDING' },
};

export type UserSummary = { id: string; username: string; displayName: string | null };

@Injectable()
export class FollowsService {
  constructor(private readonly dataSource: DataSource) {}

  async follow(viewerId: string, targetId: string): Promise<Relationship> {
    if (viewerId === targetId) {
      throw new BadRequestException("You can't follow yourself");
    }
    return this.dataSource.transaction(async (manager) => {
      await this.requireCompleteProfile(manager, viewerId);
      const target = await this.lockProfile(manager, targetId);
      const current = await this.statusOf(manager, viewerId, targetId);
      const next = statusAfterFollow(current, target.isPrivate);
      if (next !== current) {
        await manager.query(
          `INSERT INTO follows (follower_id, followee_id, status) VALUES ($1, $2, $3)
           ON CONFLICT (follower_id, followee_id)
           DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
          [viewerId, targetId, next],
        );
      }
      return relationshipOf(viewerId, targetId, next);
    });
  }

  /** Unfollows, or cancels a pending request (G1). A rejected request is kept. */
  async unfollow(viewerId: string, targetId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProfile(manager, targetId);
      await manager.query(
        `DELETE FROM follows
         WHERE follower_id = $1 AND followee_id = $2 AND status IN ('PENDING', 'ACCEPTED')`,
        [viewerId, targetId],
      );
    });
  }

  async respond(
    ownerId: string,
    followerId: string,
    decision: 'ACCEPTED' | 'REJECTED',
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProfile(manager, ownerId);
      const result = await manager.update(
        Follow,
        { followerId, followeeId: ownerId, status: 'PENDING' },
        { status: decision },
      );
      if (!result.affected) {
        throw new NotFoundException('No pending request from this user');
      }
    });
  }

  /**
   * Clarification 8: when a profile turns public, every pending request is
   * accepted; rejected ones stay rejected. Runs in the caller's transaction,
   * which has already locked the profile row.
   */
  async acceptPendingRequests(manager: EntityManager, ownerId: string): Promise<void> {
    await manager.update(
      Follow,
      { followeeId: ownerId, status: 'PENDING' },
      { status: 'ACCEPTED' },
    );
  }

  async relationship(viewerId: string | undefined, ownerId: string): Promise<Relationship> {
    if (!viewerId || viewerId === ownerId) {
      return relationshipOf(viewerId, ownerId, null);
    }
    return relationshipOf(viewerId, ownerId, await this.statusOf(this.dataSource.manager, viewerId, ownerId));
  }

  /** Decision G3: may this viewer see the owner's posts and lists? null if there's no such profile. */
  async canView(ownerId: string, viewerId: string | undefined): Promise<boolean | null> {
    const [owner] = (await this.dataSource.query(
      'SELECT is_private AS "isPrivate" FROM profiles WHERE id = $1',
      [ownerId],
    )) as { isPrivate: boolean }[];
    if (!owner) {
      return null;
    }
    return canViewContent(owner.isPrivate, await this.relationship(viewerId, ownerId));
  }

  /** Decision G4: counted per request from the (followee_id, status) index, not stored. */
  async counts(profileId: string): Promise<{ followerCount: number; followingCount: number }> {
    const [counts] = (await this.dataSource.query(
      `SELECT
         (SELECT count(*) FROM follows WHERE followee_id = $1 AND status = 'ACCEPTED')::int AS "followerCount",
         (SELECT count(*) FROM follows WHERE follower_id = $1 AND status = 'ACCEPTED')::int AS "followingCount"`,
      [profileId],
    )) as { followerCount: number; followingCount: number }[];
    return counts;
  }

  /** Incoming pending requests only; uses the existing followee/status index. */
  pendingCount(ownerId: string): Promise<number> {
    return this.dataSource.getRepository(Follow).countBy({
      followeeId: ownerId,
      status: 'PENDING',
    });
  }

  /** Followers, following or incoming requests, most recent first. */
  async list(kind: ListKind, profileId: string, cursorParam?: string): Promise<Page<UserSummary>> {
    const { own, other, status } = LISTS[kind];
    const cursor = decodeCursor(cursorParam, isUUID);
    const rows = (await this.dataSource.query(
      `SELECT p.id, p.username, p.display_name AS "displayName",
              to_char(f.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime"
       FROM follows f
       JOIN profiles p ON p.id = f.${other}
       WHERE f.${own} = $1 AND f.status = $2
         AND ($3::timestamptz IS NULL OR (f.updated_at, p.id) < ($3::timestamptz, $4::uuid))
       ORDER BY f.updated_at DESC, p.id DESC
       LIMIT ${PAGE_SIZE + 1}`,
      [profileId, status, cursor?.time ?? null, cursor?.id ?? null],
    )) as (UserSummary & { cursorTime: string })[];

    const page = toPage(rows, PAGE_SIZE, (last) => ({ time: last.cursorTime, id: last.id }));
    return {
      ...page,
      items: page.items.map(({ id, username, displayName }) => ({ id, username, displayName })),
    };
  }

  /** For Feed: accepted follows with each followee's follower count (popularity, F3). */
  async followingWithCounts(userId: string): Promise<{ userId: string; followerCount: number }[]> {
    return (await this.dataSource.query(
      `SELECT f.followee_id AS "userId", count(c.follower_id)::int AS "followerCount"
       FROM follows f
       LEFT JOIN follows c ON c.followee_id = f.followee_id AND c.status = 'ACCEPTED'
       WHERE f.follower_id = $1 AND f.status = 'ACCEPTED'
       GROUP BY f.followee_id`,
      [userId],
    )) as { userId: string; followerCount: number }[];
  }

  // Decision G2: every follow change locks the target's profile row, so a
  // request can't slip in as PENDING while the profile turns public. NO KEY
  // UPDATE, because FOR UPDATE would block the KEY SHARE lock that the follows
  // foreign key takes on the follower's row, and mutual follows would deadlock.
  private async lockProfile(
    manager: EntityManager,
    profileId: string,
  ): Promise<{ isPrivate: boolean }> {
    const [profile] = (await manager.query(
      'SELECT is_private AS "isPrivate", username FROM profiles WHERE id = $1 FOR NO KEY UPDATE',
      [profileId],
    )) as { isPrivate: boolean; username: string | null }[];
    if (!profile?.username) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  /** Decision I7: following requires a finished profile. */
  private async requireCompleteProfile(manager: EntityManager, profileId: string): Promise<void> {
    const [profile] = (await manager.query('SELECT username FROM profiles WHERE id = $1', [
      profileId,
    ])) as { username: string | null }[];
    if (!profile?.username) {
      throw new ForbiddenException('Finish setting up your profile first');
    }
  }

  private async statusOf(
    manager: EntityManager,
    followerId: string,
    followeeId: string,
  ): Promise<FollowStatus | null> {
    const follow = await manager.findOneBy(Follow, { followerId, followeeId });
    return follow?.status ?? null;
  }
}
