import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { requireEnv } from './env.js';

export type AuthUser = { id: string };

type AuthenticatedRequest = Request & { user?: AuthUser };

const jwt = new JwtService();

function bearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}

// Only access tokens verify here: refresh tokens are signed with a secret that
// only Auth has (decision I3).
async function verifyAccessToken(token: string): Promise<AuthUser> {
  try {
    const payload = await jwt.verifyAsync<{ sub: string }>(token, {
      secret: requireEnv('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
    });
    return { id: payload.sub };
  } catch {
    throw new UnauthorizedException();
  }
}

/** Requires a valid access token in `Authorization: Bearer`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    request.user = await verifyAccessToken(token);
    return true;
  }
}

/**
 * Lets anonymous requests through. A token that is present but invalid still
 * gets 401, so the client refreshes instead of silently becoming anonymous.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);
    if (token) {
      request.user = await verifyAccessToken(token);
    }
    return true;
  }
}

/** The user set by a guard (or Passport); undefined for anonymous requests. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
