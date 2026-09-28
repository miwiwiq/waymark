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
  AuthorPostsQuery,
  CreatePostDto,
  PresignDto,
  UpdatePostDto,
  type PostView,
} from './dto.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('uploads')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.posts.presignUploads(user.id, dto.files);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto): Promise<PostView> {
    return this.posts.create(user.id, dto);
  }

  /** The caller's archived posts; declared before :id so "archived" isn't read as an id. */
  @Get('archived')
  @UseGuards(JwtAuthGuard)
  archived(@CurrentUser() user: AuthUser, @Query() query: PageQuery): Promise<Page<PostView>> {
    return this.posts.listArchived(user.id, query.cursor);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  byAuthor(
    @CurrentUser() viewer: AuthUser | undefined,
    @Query() query: AuthorPostsQuery,
  ): Promise<Page<PostView>> {
    return this.posts.listByAuthor(query.authorId, viewer?.id, query.cursor);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  get(@CurrentUser() viewer: AuthUser | undefined, @Param('id') id: string): Promise<PostView> {
    return this.posts.getVisible(id, viewer?.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostView> {
    return this.posts.update(user.id, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PostView> {
    return this.posts.setArchived(user.id, id, true);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PostView> {
    return this.posts.setArchived(user.id, id, false);
  }
}
