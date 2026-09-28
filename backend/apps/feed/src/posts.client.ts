import { internalRequest, requireEnv, type Page } from '@app/common';
import { Injectable } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import type { PostView } from './dto.js';

/** Post Service's internal API (decision A6). */
@Injectable()
export class PostsClient {
  private readonly baseUrl = requireEnv('POSTS_INTERNAL_URL');

  /** Live posts of the given authors, newest first, older than the cursor (F2). */
  async query(authorIds: string[], limit: number, cursor?: string): Promise<Page<PostView>> {
    const page = await internalRequest<Page<PostView>>(`${this.baseUrl}/internal/posts/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorIds, limit, cursor }),
    });
    return page ?? { items: [], nextCursor: null };
  }

  /** Decision F1: likes and comments follow the post's visibility (G3). */
  async canView(postId: string, viewerId: string | undefined): Promise<boolean> {
    if (!isMongoId(postId)) {
      return false;
    }
    const query = viewerId ? `?viewerId=${viewerId}` : '';
    const result = await internalRequest<{ canView: boolean }>(
      `${this.baseUrl}/internal/posts/${postId}/can-view${query}`,
    );
    return result?.canView ?? false;
  }
}
