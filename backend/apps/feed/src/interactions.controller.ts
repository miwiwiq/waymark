import {
  CurrentUser,
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  PageQuery,
  type AuthUser,
  type Page,
} from '@app/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentDto, type CommentView, type Stats } from './dto.js';
import { InteractionsService } from './interactions.service.js';

@ApiTags('interactions')
@ApiBearerAuth()
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  /** Counts for everyone; likedByMe needs a token. */
  @Get('posts/:postId/stats')
  @UseGuards(OptionalJwtAuthGuard)
  stats(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param('postId') postId: string,
  ): Promise<Stats> {
    return this.interactions.getStats(postId, viewer?.id);
  }

  @Put('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  like(@CurrentUser() user: AuthUser, @Param('postId') postId: string): Promise<Stats> {
    return this.interactions.like(postId, user.id);
  }

  @Delete('posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  unlike(@CurrentUser() user: AuthUser, @Param('postId') postId: string): Promise<Stats> {
    return this.interactions.unlike(postId, user.id);
  }

  @Get('posts/:postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  comments(
    @CurrentUser() viewer: AuthUser | undefined,
    @Param('postId') postId: string,
    @Query() query: PageQuery,
  ): Promise<Page<CommentView>> {
    return this.interactions.listComments(postId, viewer?.id, query.cursor);
  }

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('postId') postId: string,
    @Body() dto: CommentDto,
  ): Promise<CommentView> {
    return this.interactions.addComment(postId, user.id, dto.body);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.interactions.deleteComment(commentId, user.id);
  }
}
