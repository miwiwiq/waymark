import { requireEnv } from '@app/common';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export type Session = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

type RefreshClaims = { sub: string; jti: string };

/**
 * The classic access + refresh pair (decision I3). Both are HS256 JWTs with
 * different secrets; Redis holds one entry per issued refresh token, so
 * deleting it logs that session out.
 */
@Injectable()
export class TokenService implements OnModuleDestroy {
  private readonly jwt = new JwtService();
  private readonly redis = new Redis(requireEnv('REDIS_URL'));
  private readonly accessSecret = requireEnv('JWT_ACCESS_SECRET');
  private readonly refreshSecret = requireEnv('JWT_REFRESH_SECRET');

  async startSession(userId: string): Promise<Session> {
    const tokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: tokenId },
      {
        secret: this.refreshSecret,
        expiresIn: REFRESH_TTL_SECONDS,
        algorithm: 'HS256',
      },
    );
    await this.redis.set(refreshKey(tokenId), userId, 'EX', REFRESH_TTL_SECONDS);
    return { userId, accessToken: await this.accessToken(userId), refreshToken };
  }

  /** A new access token, or null if the refresh token is invalid, expired or logged out. */
  async refresh(
    refreshToken: string,
  ): Promise<{ userId: string; accessToken: string } | null> {
    const claims = await this.verifyRefreshToken(refreshToken);
    if (!claims || (await this.redis.get(refreshKey(claims.jti))) !== claims.sub) {
      return null;
    }
    return { userId: claims.sub, accessToken: await this.accessToken(claims.sub) };
  }

  async revoke(refreshToken: string): Promise<void> {
    const claims = await this.verifyRefreshToken(refreshToken);
    if (claims) {
      await this.redis.del(refreshKey(claims.jti));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private accessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.accessSecret,
        expiresIn: ACCESS_TTL_SECONDS,
        algorithm: 'HS256',
      },
    );
  }

  private async verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
    try {
      return await this.jwt.verifyAsync<RefreshClaims>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      return null;
    }
  }
}

function refreshKey(tokenId: string): string {
  return `refresh:${tokenId}`;
}
