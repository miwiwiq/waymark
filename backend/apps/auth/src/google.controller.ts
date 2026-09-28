import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, type GoogleUser } from './auth.service.js';
import { GoogleAuthGuard } from './google.strategy.js';
import { setRefreshCookie } from './refresh-cookie.js';

/** Registered only when Google keys are set (see AuthModule). */
@ApiTags('auth')
@Controller('auth/google')
@UseGuards(GoogleAuthGuard)
export class GoogleAuthController {
  constructor(private readonly auth: AuthService) {}

  /** The guard redirects to Google's consent screen. */
  @Get()
  start(): void {}

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // The guard has checked the OAuth state, so its session is done. The
    // in-memory store never drops it on its own (L13).
    req.session.destroy(() => undefined);

    const googleUser = req.user as GoogleUser | null;
    if (!googleUser) {
      return res.redirect('/login?error=google_failed');
    }

    const result = await this.auth.loginWithGoogle(googleUser);
    if (result === 'email_in_use') {
      return res.redirect('/login?error=email_in_use');
    }

    // New users have no username yet; the web app sends them to /onboarding (I7).
    setRefreshCookie(res, result.refreshToken);
    res.redirect('/');
  }
}
