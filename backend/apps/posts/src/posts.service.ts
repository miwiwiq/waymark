import { toPage, UsersClient, type Page } from '@app/common';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { decodePostCursor, olderThan, postCursor } from './cursor.js';
import type {
  CreatePostDto,
  MediaInputDto,
  PostView,
  UpdatePostDto,
  UploadRequestDto,
} from './dto.js';
import { describeLimit, MEDIA_TYPES, uploadPrefix } from './media-rules.js';
import { Post, type Media, type PostDocument } from './post.schema.js';
import { StorageService } from './storage.service.js';

const PAGE_SIZE = 20;

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    private readonly storage: StorageService,
    private readonly users: UsersClient,
  ) {}

  /** One pre-signed PUT per file; the browser uploads straight to MinIO (P2). */
  presignUploads(
    userId: string,
    files: UploadRequestDto[],
  ): Promise<{ key: string; uploadUrl: string }[]> {
    return Promise.all(
      files.map(async ({ contentType, size }) => {
        const rule = MEDIA_TYPES[contentType];
        if (size > rule.maxBytes) {
          throw new BadRequestException(describeLimit(rule.kind));
        }
        const key = `${uploadPrefix(userId)}${randomUUID()}.${rule.extension}`;
        return { key, uploadUrl: await this.storage.presignUpload(key, contentType) };
      }),
    );
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostView> {
    const authorUsername = await this.users.username(userId);
    if (!authorUsername) {
      throw new ForbiddenException('Finish setting up your profile first');
    }
    assertTripDates(dto.tripStart, dto.tripEnd);

    const post = await this.posts.create({
      authorId: userId,
      authorUsername,
      title: dto.title,
      caption: dto.caption ?? '',
      location: dto.location,
      tripStart: dto.tripStart,
      tripEnd: dto.tripEnd,
      media: await this.checkUploads(userId, dto.media, []),
    });
    return this.toView(post);
  }

  /** Files dropped from a post stay in storage (P4, L4). */
  async update(userId: string, id: string, dto: UpdatePostDto): Promise<PostView> {
    const post = await this.findOwn(userId, id);
    const tripStart = dto.tripStart ?? post.tripStart;
    const tripEnd = dto.tripEnd ?? post.tripEnd;
    assertTripDates(tripStart, tripEnd);

    if (dto.media) {
      post.media = await this.checkUploads(userId, dto.media, post.media);
    }
    if (dto.title !== undefined) post.title = dto.title;
    // The caption is optional on its own, so null gets past validation; it clears the caption.
    if (dto.caption !== undefined) post.caption = dto.caption ?? '';
    if (dto.location !== undefined) post.location = dto.location;
    post.tripStart = tripStart;
    post.tripEnd = tripEnd;
    await post.save();
    return this.toView(post);
  }

  async setArchived(userId: string, id: string, isArchived: boolean): Promise<PostView> {
    const post = await this.findOwn(userId, id);
    post.isArchived = isArchived;
    await post.save();
    return this.toView(post);
  }

  async getVisible(id: string, viewerId: string | undefined): Promise<PostView> {
    return this.toView(await this.findVisible(id, viewerId));
  }

  /** A profile's live posts; private profiles only for their owner and accepted followers (G3). */
  async listByAuthor(
    authorId: string,
    viewerId: string | undefined,
    cursor: string | undefined,
  ): Promise<Page<PostView>> {
    if (authorId !== viewerId && !(await this.users.canView(authorId, viewerId))) {
      throw new ForbiddenException('This account is private');
    }
    return this.page({ authorId, isArchived: false }, cursor);
  }

  listArchived(userId: string, cursor: string | undefined): Promise<Page<PostView>> {
    return this.page({ authorId: userId, isArchived: true }, cursor);
  }

  /** For Feed: live posts of the given authors, newest first (F2). */
  queryByAuthors(
    authorIds: string[],
    cursor: string | undefined,
    limit = PAGE_SIZE,
  ): Promise<Page<PostView>> {
    return this.page({ authorId: { $in: authorIds }, isArchived: false }, cursor, limit);
  }

  /** For Feed: may this viewer see the post, and so like or comment on it? */
  async canView(id: string, viewerId: string | undefined): Promise<boolean> {
    try {
      await this.findVisible(id, viewerId);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) return false;
      throw error;
    }
  }

  private async page(
    filter: QueryFilter<Post>,
    cursorParam: string | undefined,
    limit = PAGE_SIZE,
  ): Promise<Page<PostView>> {
    const cursor = decodePostCursor(cursorParam);
    const posts = await this.posts
      .find(cursor ? { ...filter, ...olderThan(cursor) } : filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
    const page = toPage(posts, limit, postCursor);
    return { ...page, items: await Promise.all(page.items.map((post) => this.toView(post))) };
  }

  // Decision G3: 404 rather than 403, so a hidden post doesn't reveal that it exists.
  private async findVisible(id: string, viewerId: string | undefined): Promise<PostDocument> {
    const post = await this.findById(id);
    if (post.authorId === viewerId) {
      return post;
    }
    if (post.isArchived || !(await this.users.canView(post.authorId, viewerId))) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async findOwn(userId: string, id: string): Promise<PostDocument> {
    const post = await this.findById(id);
    if (post.authorId !== userId) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async findById(id: string): Promise<PostDocument> {
    const post = isValidObjectId(id) ? await this.posts.findById(id) : null;
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  /**
   * Decision P2: each new key must be the author's own upload, exist, and have
   * an allowed type and size as stored. Files already on the post were checked
   * when they were added, and keep what was stored for them then.
   */
  private checkUploads(userId: string, items: MediaInputDto[], current: Media[]): Promise<Media[]> {
    const known = new Map(current.map((media) => [media.key, media]));
    return Promise.all(
      items.map(async ({ key, color, width, height }): Promise<Media> => {
        const stored = known.get(key);
        if (stored) {
          return { key, type: stored.type, color: stored.color, width: stored.width, height: stored.height };
        }
        const object = key.startsWith(uploadPrefix(userId)) ? await this.storage.inspect(key) : null;
        if (!object) {
          throw new BadRequestException(`Upload not found: ${key}`);
        }
        const rule = MEDIA_TYPES[object.contentType];
        if (!rule) {
          throw new BadRequestException(`Unsupported file type: ${object.contentType}`);
        }
        if (object.size > rule.maxBytes) {
          throw new BadRequestException(describeLimit(rule.kind));
        }
        return { key, type: rule.kind, color, width, height };
      }),
    );
  }

  private async toView(post: PostDocument): Promise<PostView> {
    return {
      id: post._id.toString(),
      authorId: post.authorId,
      authorUsername: post.authorUsername,
      title: post.title,
      caption: post.caption,
      location: {
        country: post.location.country,
        city: post.location.city,
        lat: post.location.lat,
        lng: post.location.lng,
      },
      tripStart: post.tripStart,
      tripEnd: post.tripEnd,
      media: await Promise.all(
        post.media.map(async ({ key, type, color, width, height }) => ({
          key,
          type,
          url: await this.storage.signRead(key),
          color,
          width,
          height,
        })),
      ),
      isArchived: post.isArchived,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}

function assertTripDates(tripStart: string, tripEnd: string): void {
  if (tripEnd < tripStart) {
    throw new BadRequestException('tripEnd must not be before tripStart');
  }
}
