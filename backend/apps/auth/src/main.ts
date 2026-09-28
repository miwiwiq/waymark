import { bootstrapService, requireEnv } from '@app/common';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { AuthModule } from './auth.module.js';
import { googleEnabled } from './google.strategy.js';

await bootstrapService(AuthModule, 'auth', {
  beforeListen: (app) => {
    app.use(cookieParser());

    // Only the Google handshake needs a server session: Passport keeps the
    // OAuth state there for a few minutes (decision I6). The in-memory store
    // is fine for a single Auth instance.
    if (googleEnabled()) {
      app.use(
        '/api/auth/google',
        session({
          secret: requireEnv('OAUTH_SESSION_SECRET'),
          resave: false,
          saveUninitialized: false,
          cookie: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/api/auth/google',
            maxAge: 10 * 60 * 1000,
          },
        }),
      );
    }
  },
});
