import { requireEnv } from '@app/common';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import type { GoogleUser } from './auth.service.js';

/** Google login is optional: it's registered only when both keys are set. */
export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${process.env.PUBLIC_URL ?? 'http://localhost:8080'}/api/auth/google/callback`,
      scope: ['email', 'profile'],
      // Passport keeps the OAuth state in the session that main.ts enables
      // for the Google routes only.
      state: true,
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleUser {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('The Google account has no email address');
    }
    return { googleId: profile.id, email: email.toLowerCase() };
  }
}

/**
 * Nest's guard throws on failure (cancelled consent, bad state); returning
 * null instead lets the callback send the user back to the login page.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  handleRequest<T>(error: unknown, user: T): T {
    // A cancelled consent has no error; errors mean bad keys, a bad state or a failed token exchange.
    if (error) {
      this.logger.warn(
        `Google sign-in failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
    }
    return (error || !user ? null : user) as T;
  }
}
