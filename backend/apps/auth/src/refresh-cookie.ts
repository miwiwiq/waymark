import type { CookieOptions, Response } from 'express';
import { REFRESH_TTL_SECONDS } from './token.service.js';

export const REFRESH_COOKIE = 'refresh_token';

// Scoped to /api/auth, so the browser only sends it to refresh and logout
// (decision I4). Secure is off by default because the stack runs on plain
// http://localhost.
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/api/auth',
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}
