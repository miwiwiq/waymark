import { decodeCursor, UsersClient, type Followee, type Page } from '@app/common';
import { Injectable } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { Redis } from 'ioredis';
import type { FeedItem, PostView } from './dto.js';
import { mergeFirstPage } from './merge.js';
import { PostsClient } from './posts.client.js';
import { StatsService } from './stats.service.js';

const PAGE_SIZE = 20;
const TOP_TTL_SECONDS = 60;
const topKey = (authorId: string) => `author:${authorId}:top20`;

/**
 * Fan-out on read: the viewer's own posts plus those of accepted follows,
 * newest first (F2).
 */
@Injectable()
export class FeedService {
  private readonly popularThreshold = Number(process.env.POPULAR_FOLLOWER_THRESHOLD ?? 100);

  constructor(
    private readonly users: UsersClient,
    private readonly posts: PostsClient,
    private readonly stats: StatsService,
    private readonly redis: Redis,
  ) {}

  async page(viewerId: string, cursor: string | undefined): Promise<Page<FeedItem>> {
    decodeCursor(cursor, isMongoId); // a bad cursor is the client's 400, not Post Service's
    const following = await this.users.following(viewerId);
    const page = cursor
      ? await this.posts.query([viewerId, ...following.map((f) => f.userId)], PAGE_SIZE, cursor)
      : await this.firstPage(viewerId, following);

    const stats = await this.stats.forPosts(
      page.items.map((post) => post.id),
      viewerId,
    );
    return {
      items: page.items.map((post) => ({ ...post, stats: stats.get(post.id)! })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * Decision F3: popular authors' latest posts come from Redis; one query
   * covers everyone else, including the viewer, who always sees their own
   * changes at once. Later pages are a single query older than the cursor.
   */
  private async firstPage(viewerId: string, following: Followee[]): Promise<Page<PostView>> {
    const isPopular = (f: Followee) => f.followerCount >= this.popularThreshold;
    const others = [viewerId, ...following.filter((f) => !isPopular(f)).map((f) => f.userId)];
    const sources = await Promise.all([
      this.posts.query(others, PAGE_SIZE),
      ...following.filter(isPopular).map((f) => this.latestOf(f.userId)),
    ]);
    return mergeFirstPage(sources, PAGE_SIZE);
  }

  /** No invalidation: a list can be up to 60 s old (L11). Without Redis it's read fresh (F4). */
  private async latestOf(authorId: string): Promise<Page<PostView>> {
    const cached = await this.redis.get(topKey(authorId)).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as Page<PostView>;
    }
    const page = await this.posts.query([authorId], PAGE_SIZE);
    await this.redis
      .set(topKey(authorId), JSON.stringify(page), 'EX', TOP_TTL_SECONDS)
      .catch(() => undefined);
    return page;
  }
}
