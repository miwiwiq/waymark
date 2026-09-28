import { isUniqueViolation, USER_CREATED, type UserCreatedEvent } from '@app/common';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from '@node-rs/argon2';
import type { Repository } from 'typeorm';
import { Account } from './account.entity.js';
import type { RegisterDto } from './dto.js';
import { TokenService, type Session } from './token.service.js';

export const USERS_EVENTS = Symbol('USERS_EVENTS');

/** What the Google strategy extracts from the Google profile. */
export type GoogleUser = { googleId: string; email: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @Inject(USERS_EVENTS) private readonly events: ClientProxy,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<Session> {
    let account: Account;
    try {
      account = await this.accounts.save(
        this.accounts.create({
          email: dto.email,
          passwordHash: await hash(dto.password),
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error, 'accounts_email_key')) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    this.publishUserCreated({
      userId: account.id,
      username: dto.username,
      dateOfBirth: dto.dateOfBirth,
    });
    return this.tokens.startSession(account.id);
  }

  /** For the local strategy: null for unknown emails, Google-only accounts and wrong passwords. */
  async checkPassword(email: string, password: string): Promise<Account | null> {
    const account = await this.accounts.findOneBy({ email });
    if (!account?.passwordHash) {
      return null;
    }
    return (await verify(account.passwordHash, password)) ? account : null;
  }

  async loginWithGoogle(google: GoogleUser): Promise<Session | 'email_in_use'> {
    const existing = await this.accounts.findOneBy({ googleId: google.googleId });
    if (existing) {
      return this.tokens.startSession(existing.id);
    }

    // No automatic linking (decision I6): email signup doesn't verify
    // addresses, so an existing account may belong to someone else.
    if (await this.accounts.existsBy({ email: google.email })) {
      return 'email_in_use';
    }

    const account = await this.accounts.save(
      this.accounts.create({
        email: google.email,
        googleId: google.googleId,
        passwordHash: null,
      }),
    );
    this.publishUserCreated({ userId: account.id, username: null, dateOfBirth: null });
    return this.tokens.startSession(account.id);
  }

  // Doesn't wait for the broker (decision A5). If RabbitMQ is down, the event
  // is lost (L5) and the web app ends in its profile error state.
  private publishUserCreated(event: UserCreatedEvent): void {
    this.events.emit(USER_CREATED, event).subscribe({
      error: (error: unknown) =>
        this.logger.error(
          `Couldn't publish ${USER_CREATED} for ${event.userId}: ${String(error)}`,
        ),
    });
  }
}
