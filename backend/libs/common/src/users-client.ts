import { Injectable } from '@nestjs/common';
import { requireEnv } from './env.js';
import { internalRequest } from './internal-http.js';

export type Followee = { userId: string; followerCount: number };

/** User Service's internal API (decision A6), for Posts and Feed. */
@Injectable()
export class UsersClient {
  private readonly baseUrl = requireEnv('USERS_INTERNAL_URL');

  /** null if the profile doesn't exist yet or has no username (I7). Posts and comments copy it (I2). */
  async username(userId: string): Promise<string | null> {
    const user = await internalRequest<{ username: string | null }>(
      `${this.baseUrl}/internal/users/${userId}`,
    );
    return user?.username ?? null;
  }

  /** Decision G3: public profiles, the owner, and accepted followers. */
  async canView(ownerId: string, viewerId: string | undefined): Promise<boolean> {
    const query = viewerId ? `?viewerId=${viewerId}` : '';
    const result = await internalRequest<{ canView: boolean }>(
      `${this.baseUrl}/internal/users/${ownerId}/can-view${query}`,
    );
    return result?.canView ?? false;
  }

  /** Accepted follows, with each followee's follower count (F2, F3). */
  async following(userId: string): Promise<Followee[]> {
    return (
      (await internalRequest<Followee[]>(`${this.baseUrl}/internal/users/${userId}/following`)) ??
      []
    );
  }
}
