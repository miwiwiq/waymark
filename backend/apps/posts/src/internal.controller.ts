import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CanViewQuery, InternalQueryDto } from './dto.js';
import { PostsService } from './posts.service.js';

/** Service-to-service API for Feed, outside /api (decision A1). */
@ApiExcludeController()
@Controller('internal/posts')
export class InternalPostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('query')
  @HttpCode(200)
  query(@Body() dto: InternalQueryDto) {
    return this.posts.queryByAuthors(dto.authorIds, dto.cursor, dto.limit);
  }

  @Get(':id/can-view')
  async canView(@Param('id') id: string, @Query() query: CanViewQuery) {
    return { canView: await this.posts.canView(id, query.viewerId) };
  }
}
