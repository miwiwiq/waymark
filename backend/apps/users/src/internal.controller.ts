import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CanViewQuery } from './dto.js';
import { FollowsService } from './follows.service.js';
import { ProfilesService } from './profiles.service.js';

/**
 * Service-to-service API, outside /api, so the gateway never forwards it
 * (decision A1).
 */
@ApiExcludeController()
@Controller('internal/users')
export class InternalUsersController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly follows: FollowsService,
  ) {}

  /** Posts and Feed copy the author's username from here (I2). */
  @Get(':id')
  async byId(@Param('id', ParseUUIDPipe) id: string) {
    const profile = await this.profiles.getOwn(id);
    return {
      id: profile.id,
      username: profile.username,
      complete: profile.username !== null,
    };
  }

  /** Feed: accepted follows with follower counts (F2, F3). */
  @Get(':id/following')
  following(@Param('id', ParseUUIDPipe) id: string) {
    return this.follows.followingWithCounts(id);
  }

  /** Posts: may this viewer (or an anonymous visitor) see the owner's posts? (G3) */
  @Get(':id/can-view')
  async canView(@Param('id', ParseUUIDPipe) ownerId: string, @Query() query: CanViewQuery) {
    return { canView: (await this.follows.canView(ownerId, query.viewerId)) ?? false };
  }
}
