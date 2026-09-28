import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthUser,
} from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  OnboardingDto,
  toOwnProfile,
  toPublicProfile,
  UpdateProfileDto,
  UsernameQuery,
  type UsernameAvailability,
} from './dto.js';
import { canViewContent } from './follow-rules.js';
import { FollowsService } from './follows.service.js';
import { ProfilesService } from './profiles.service.js';

@ApiTags('users')
@Controller('users')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly follows: FollowsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return toOwnProfile(await this.profiles.getOwn(user.id));
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return toOwnProfile(await this.profiles.updateOwn(user.id, dto));
  }

  @Post('me/onboarding')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingDto,
  ) {
    return toOwnProfile(await this.profiles.completeOnboarding(user.id, dto));
  }

  /** Public: the signup form calls it while the user types (decision I8). */
  @Get('username-available')
  checkUsername(@Query() query: UsernameQuery): Promise<UsernameAvailability> {
    return this.profiles.checkUsername(query.username);
  }

  /** The profile header is public even for private profiles (G3); `canViewContent` says whether the rest is. */
  @Get('by-username/:username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  async byUsername(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param('username') username: string,
  ) {
    const profile = await this.profiles.getByUsername(username.toLowerCase());
    const [counts, relationship] = await Promise.all([
      this.follows.counts(profile.id),
      this.follows.relationship(viewer?.id, profile.id),
    ]);
    return {
      ...toPublicProfile(profile),
      ...counts,
      relationship,
      canViewContent: canViewContent(profile.isPrivate, relationship),
    };
  }
}
