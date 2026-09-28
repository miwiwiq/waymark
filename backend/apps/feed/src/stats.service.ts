import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import type { Counts, Stats } from './dto.js';

const STATS_TTL_SECONDS = 5 * 60;
const statsKey = (postId: string) => `post:${postId}:stats`;

/**
 * Like and comment counts, cache-aside in Redis (F3), plus whether the viewer
 * liked each post, which is per user and always read from Postgres. If Redis
 * fails, counts come from Postgres (F4).
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: Redis,
  ) {}

  async forPosts(postIds: string[], viewerId: string | undefined): Promise<Map<string, Stats>> {
    if (postIds.length === 0) {
      return new Map();
    }
    const [counts, liked] = await Promise.all([
      this.counts(postIds),
      this.likedBy(viewerId, postIds),
    ]);
    return new Map(
      postIds.map((id) => [
        id,
        { ...(counts.get(id) ?? { likeCount: 0, commentCount: 0 }), likedByMe: liked.has(id) },
      ]),
    );
  }

  async forPost(postId: string, viewerId: string | undefined): Promise<Stats> {
    const stats = await this.forPosts([postId], viewerId);
    return stats.get(postId)!;
  }

  /** Called after every like or comment change. */
  async invalidate(postId: string): Promise<void> {
    await this.redis.del(statsKey(postId)).catch(() => undefined);
  }

  private async counts(postIds: string[]): Promise<Map<string, Counts>> {
    const cached = await this.redis
      .mget(postIds.map(statsKey))
      .catch(() => postIds.map(() => null));
    const counts = new Map<string, Counts>();
    const missing = postIds.filter((id, index) => {
      const hit = cached[index];
      if (hit) {
        counts.set(id, JSON.parse(hit) as Counts);
      }
      return !hit;
    });
    if (missing.length === 0) {
      return counts;
    }

    // Both counts come from the primary key and the (post_id, created_at, id) index.
    const rows = (await this.dataSource.query(
      `SELECT p.id AS "postId",
              (SELECT count(*) FROM likes l WHERE l.post_id = p.id)::int AS "likeCount",
              (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS "commentCount"
       FROM unnest($1::text[]) AS p(id)`,
      [missing],
    )) as (Counts & { postId: string })[];

    const write = this.redis.pipeline();
    for (const { postId, likeCount, commentCount } of rows) {
      counts.set(postId, { likeCount, commentCount });
      write.set(statsKey(postId), JSON.stringify({ likeCount, commentCount }), 'EX', STATS_TTL_SECONDS);
    }
    await write.exec().catch(() => undefined);
    return counts;
  }

  private async likedBy(viewerId: string | undefined, postIds: string[]): Promise<Set<string>> {
    if (!viewerId) {
      return new Set();
    }
    const rows = (await this.dataSource.query(
      'SELECT post_id AS "postId" FROM likes WHERE user_id = $1 AND post_id = ANY($2::text[])',
      [viewerId, postIds],
    )) as { postId: string }[];
    return new Set(rows.map((row) => row.postId));
  }
}
