import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  PageQuery,
  type AuthUser,
  type Page,
} from '@app/common';
import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Relationship } from './follow-rules.js';
import { FollowsService, type ListKind, type UserSummary } from './follows.service.js';

@ApiTags('follows')
@ApiBearerAuth()
@Controller('users')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post(':id/follow')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async follow(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<{ relationship: Relationship }> {
    return { relationship: await this.follows.follow(user.id, targetId) };
  }

  /** Unfollow, or cancel a pending request. */
  @Delete(':id/follow')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async unfollow(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) targetId: string,
  ): Promise<void> {
    await this.follows.unfollow(user.id, targetId);
  }

  @Get('me/requests/count')
  @UseGuards(JwtAuthGuard)
  async requestCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.follows.pendingCount(user.id) };
  }

  @Get('me/requests')
  @UseGuards(JwtAuthGuard)
  requests(@CurrentUser() user: AuthUser, @Query() query: PageQuery): Promise<Page<UserSummary>> {
    return this.follows.list('requests', user.id, query.cursor);
  }

  @Post('me/requests/:id/accept')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) followerId: string,
  ): Promise<void> {
    await this.follows.respond(user.id, followerId, 'ACCEPTED');
  }

  @Post('me/requests/:id/reject')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) followerId: string,
  ): Promise<void> {
    await this.follows.respond(user.id, followerId, 'REJECTED');
  }

  @Get(':id/followers')
  @UseGuards(OptionalJwtAuthGuard)
  followers(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param('id', ParseUUIDPipe) profileId: string,
    @Query() query: PageQuery,
  ): Promise<Page<UserSummary>> {
    return this.visibleList('followers', profileId, viewer, query.cursor);
  }

  @Get(':id/following')
  @UseGuards(OptionalJwtAuthGuard)
  following(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param('id', ParseUUIDPipe) profileId: string,
    @Query() query: PageQuery,
  ): Promise<Page<UserSummary>> {
    return this.visibleList('following', profileId, viewer, query.cursor);
  }

  // Decision G3: a private profile's lists are for accepted followers only.
  private async visibleList(
    kind: ListKind,
    profileId: string,
    viewer: AuthUser | undefined,
    cursor: string | undefined,
  ): Promise<Page<UserSummary>> {
    const canView = await this.follows.canView(profileId, viewer?.id);
    if (canView === null) {
      throw new NotFoundException('Profile not found');
    }
    if (!canView) {
      throw new ForbiddenException('This account is private');
    }
    return this.follows.list(kind, profileId, cursor);
  }
}
