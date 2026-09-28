import { CurrentUser, JwtAuthGuard, PageQuery, type AuthUser, type Page } from '@app/common';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FeedItem } from './dto.js';
import { FeedService } from './feed.service.js';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  page(@CurrentUser() user: AuthUser, @Query() query: PageQuery): Promise<Page<FeedItem>> {
    return this.feed.page(user.id, query.cursor);
  }
}
