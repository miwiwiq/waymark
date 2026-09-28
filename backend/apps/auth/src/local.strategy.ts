import type { AuthUser } from '@app/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email' });
  }

  // The login body isn't validated by a DTO, so the values can be of any JSON type.
  async validate(email: unknown, password: unknown): Promise<AuthUser> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new UnauthorizedException('Invalid email or password');
    }
    const account = await this.auth.checkPassword(
      email.trim().toLowerCase(),
      password,
    );
    if (!account) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: account.id };
  }
}
