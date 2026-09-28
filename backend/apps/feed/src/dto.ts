import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class CommentDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // Counts code points, like the table's char_length check; @Length doesn't
  // count emoji variation selectors, so it would let longer bodies through.
  @Matches(/^[\s\S]{1,1000}$/u, { message: 'body must be 1–1000 characters' })
  body: string;
}

/** A post as Post Service returns it; Feed reads only these fields and passes the rest on. */
export type PostView = { id: string; authorId: string; createdAt: string } & Record<string, unknown>;

export type Counts = { likeCount: number; commentCount: number };
export type Stats = Counts & { likedByMe: boolean };
export type FeedItem = PostView & { stats: Stats };

export type CommentView = {
  id: string;
  authorId: string;
  authorUsername: string;
  body: string;
  createdAt: string;
};
