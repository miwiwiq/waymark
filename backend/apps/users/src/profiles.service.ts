import {
  isUniqueViolation,
  USERNAME_PATTERN,
  type UserCreatedEvent,
} from '@app/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, type Repository } from 'typeorm';
import type { OnboardingDto, UpdateProfileDto, UsernameAvailability } from './dto.js';
import { FollowsService } from './follows.service.js';
import { Profile } from './profile.entity.js';

const USERNAME_TAKEN = 'profiles_username_key';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    private readonly dataSource: DataSource,
    private readonly follows: FollowsService,
  ) {}

  /** The username is not editable (decision I2). */
  async updateOwn(id: string, dto: UpdateProfileDto): Promise<Profile> {
    return this.dataSource.transaction(async (manager) => {
      // Locked like every follow change (G2), so no request can slip in as
      // PENDING while the profile turns public.
      const profile = await manager.findOne(Profile, {
        where: { id },
        lock: { mode: 'for_no_key_update' },
      });
      if (!profile) {
        throw new NotFoundException('Profile not found');
      }

      const turnsPublic = profile.isPrivate && dto.isPrivate === false;
      manager.merge(Profile, profile, dto);
      await manager.save(profile);
      if (turnsPublic) {
        await this.follows.acceptPendingRequests(manager, id);
      }
      return profile;
    });
  }

  async createFromEvent(event: UserCreatedEvent): Promise<void> {
    try {
      await this.insert(event.userId, event.username, event.dateOfBirth);
    } catch (error) {
      if (!isUniqueViolation(error, USERNAME_TAKEN)) {
        throw error;
      }
      // The name was taken after the signup form checked it: the user picks
      // another one on /onboarding (decision I7).
      await this.insert(event.userId, null, event.dateOfBirth);
    }
  }

  /** 404 right after signup, until user.created has been processed (I5). */
  async getOwn(id: string): Promise<Profile> {
    const profile = await this.profiles.findOneBy({ id });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  async getByUsername(username: string): Promise<Profile> {
    const profile = await this.profiles.findOneBy({ username });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  /** Advisory (decision I8): the unique index decides when the profile is created. */
  async checkUsername(username: string): Promise<UsernameAvailability> {
    if (!(await this.profiles.existsBy({ username }))) {
      return { available: true, suggestions: [] };
    }
    return { available: false, suggestions: await this.suggestUsernames(username) };
  }

  async completeOnboarding(id: string, dto: OnboardingDto): Promise<Profile> {
    const profile = await this.getOwn(id);
    if (profile.username !== null) {
      throw new ConflictException('This profile is already complete');
    }
    const dateOfBirth = profile.dateOfBirth ?? dto.dateOfBirth;
    if (!dateOfBirth) {
      throw new BadRequestException('dateOfBirth is required');
    }

    try {
      // `username IS NULL` keeps this a one-time step, even for concurrent requests.
      const result = await this.profiles.update(
        { id, username: IsNull() },
        { username: dto.username, dateOfBirth },
      );
      if (!result.affected) {
        throw new ConflictException('This profile is already complete');
      }
    } catch (error) {
      if (isUniqueViolation(error, USERNAME_TAKEN)) {
        throw new ConflictException('This username is taken');
      }
      throw error;
    }
    return this.getOwn(id);
  }

  // The conflict target is the id only: a redelivered event is ignored (even
  // after onboarding), while a taken username still raises an error (I5).
  private async insert(
    id: string,
    username: string | null,
    dateOfBirth: string | null,
  ): Promise<void> {
    await this.profiles.query(
      `INSERT INTO profiles (id, username, date_of_birth)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, username, dateOfBirth],
    );
  }

  /** Up to 3 free variants of a taken name, checked in one query. */
  private async suggestUsernames(taken: string): Promise<string[]> {
    const stem = taken.replace(/[._]+$/, '').slice(0, 24);
    const candidates = new Set<string>();
    while (candidates.size < 8) {
      const suffix = 10 + Math.floor(Math.random() * 990);
      candidates.add(candidates.size % 2 ? `${stem}_${suffix}` : `${stem}${suffix}`);
    }
    const valid = [...candidates].filter((name) => USERNAME_PATTERN.test(name));

    const existing = await this.profiles.find({
      select: { username: true },
      where: { username: In(valid) },
    });
    const takenNames = new Set(existing.map((profile) => profile.username));
    return valid.filter((name) => !takenNames.has(name)).slice(0, 3);
  }
}
