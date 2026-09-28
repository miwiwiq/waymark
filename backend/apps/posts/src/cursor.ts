import { decodeCursor, type Cursor } from '@app/common';
import { isMongoId } from 'class-validator';
import { Types, type QueryFilter } from 'mongoose';
import type { Post } from './post.schema.js';

/** Keyset cursor over (createdAt, _id), the order of the posts index (F2). */
type PostCursor = { createdAt: Date; id: Types.ObjectId };

export function postCursor(post: { createdAt: Date; _id: Types.ObjectId }): Cursor {
  return { time: post.createdAt.toISOString(), id: post._id.toString() };
}

export function decodePostCursor(value: string | undefined): PostCursor | null {
  const cursor = decodeCursor(value, isMongoId);
  return cursor && { createdAt: new Date(cursor.time), id: new Types.ObjectId(cursor.id) };
}

/** Posts that come after the cursor in newest-first order. */
export function olderThan(cursor: PostCursor): QueryFilter<Post> {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}
