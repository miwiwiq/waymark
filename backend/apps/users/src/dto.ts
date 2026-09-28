import { IsBirthDate, IsUsername } from '@app/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import type { Profile } from './profile.entity.js';

// An empty or blank text field clears the value.
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  // These two can be omitted but not cleared: unlike @IsOptional, this still
  // validates (and so rejects) null.
  @ApiPropertyOptional({ example: '1995-06-15' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBirthDate()
  dateOfBirth?: string;

  /** Switching to public accepts pending follow requests (clarification 8). */
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isPrivate?: boolean;
}

export class CanViewQuery {
  @IsOptional()
  @IsUUID()
  viewerId?: string;
}

export class UsernameQuery {
  @ApiProperty({ example: 'ana.travels' })
  @IsUsername()
  username: string;
}

export class OnboardingDto {
  @ApiProperty({ example: 'ana.travels' })
  @IsUsername()
  username: string;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Required when the profile has none yet (Google sign-ups).',
  })
  @IsOptional()
  @IsBirthDate()
  dateOfBirth?: string;
}

export type UsernameAvailability = { available: boolean; suggestions: string[] };

export function toOwnProfile(profile: Profile) {
  return {
    id: profile.id,
    username: profile.username,
    dateOfBirth: profile.dateOfBirth,
    displayName: profile.displayName,
    bio: profile.bio,
    isPrivate: profile.isPrivate,
    /** False until a username is set; the web app then shows /onboarding (I7). */
    complete: profile.username !== null,
  };
}

export function toPublicProfile(profile: Profile) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    isPrivate: profile.isPrivate,
  };
}
