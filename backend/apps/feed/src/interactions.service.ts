import { decodeCursor, toPage, UsersClient, type Page } from '@app/common';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { Comment } from './comment.entity.js';
import type { CommentView, Stats } from './dto.js';
import { PostsClient } from './posts.client.js';
import { StatsService } from './stats.service.js';

const COMMENTS_PAGE_SIZE = 20;

@Injectable()
export class InteractionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    private readonly stats: StatsService,
    private readonly posts: PostsClient,
    private readonly users: UsersClient,
  ) {}

  async getStats(postId: string, viewerId: string | undefined): Promise<Stats> {
    await this.requireVisible(postId, viewerId);
    return this.stats.forPost(postId, viewerId);
  }

  /** Idempotent: liking twice keeps one like (F1). */
  async like(postId: string, userId: string): Promise<Stats> {
    await this.requireVisible(postId, userId);
    await this.dataSource.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING',
      [postId, userId],
    );
    await this.stats.invalidate(postId);
    return this.stats.forPost(postId, userId);
  }

  async unlike(postId: string, userId: string): Promise<Stats> {
    await this.requireVisible(postId, userId);
    await this.dataSource.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [
      postId,
      userId,
    ]);
    await this.stats.invalidate(postId);
    return this.stats.forPost(postId, userId);
  }

  /** Newest first, keyset-paged over (created_at, id). */
  async listComments(
    postId: string,
    viewerId: string | undefined,
    cursorParam: string | undefined,
  ): Promise<Page<CommentView>> {
    const cursor = decodeCursor(cursorParam, isUUID);
    await this.requireVisible(postId, viewerId);
    // The cursor time keeps microseconds, so the next page starts exactly where this one ended.
    const rows = (await this.dataSource.query(
      `SELECT id, author_id AS "authorId", author_username AS "authorUsername", body,
              created_at AS "createdAt",
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime"
       FROM comments
       WHERE post_id = $1
         AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
       ORDER BY created_at DESC, id DESC
       LIMIT ${COMMENTS_PAGE_SIZE + 1}`,
      [postId, cursor?.time ?? null, cursor?.id ?? null],
    )) as (Omit<CommentView, 'createdAt'> & { createdAt: Date; cursorTime: string })[];

    const page = toPage(rows, COMMENTS_PAGE_SIZE, (last) => ({ time: last.cursorTime, id: last.id }));
    return { ...page, items: page.items.map(toView) };
  }

  async addComment(postId: string, userId: string, body: string): Promise<CommentView> {
    await this.requireVisible(postId, userId);
    const authorUsername = await this.users.username(userId);
    if (!authorUsername) {
      throw new ForbiddenException('Finish setting up your profile first');
    }
    const comment = await this.comments.save(
      this.comments.create({ postId, authorId: userId, authorUsername, body }),
    );
    await this.stats.invalidate(postId);
    return toView(comment);
  }

  /** Authors can delete their own comments (F1). */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.comments.findOneBy({ id: commentId, authorId: userId });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    await this.comments.delete(comment.id);
    await this.stats.invalidate(comment.postId);
  }

  // Decision F1: 404 like Post Service, so a hidden post doesn't reveal that it exists.
  private async requireVisible(postId: string, viewerId: string | undefined): Promise<void> {
    if (!(await this.posts.canView(postId, viewerId))) {
      throw new NotFoundException('Post not found');
    }
  }
}

function toView(comment: Omit<CommentView, 'createdAt'> & { createdAt: Date }): CommentView {
  return {
    id: comment.id,
    authorId: comment.authorId,
    authorUsername: comment.authorUsername,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}
