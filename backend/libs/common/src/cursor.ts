import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Keyset cursor: the sort time and id of the last item on a page, as opaque
 * base64url. Shared because Feed builds cursors that Post Service reads (F2).
 */
export type Cursor = { time: string; id: string };

export type Page<T> = { items: T[]; nextCursor: string | null };

export class PageQuery {
  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export function encodeCursor({ time, id }: Cursor): string {
  return Buffer.from(JSON.stringify([time, id])).toString('base64url');
}

/** `isId` checks the id's format for the list at hand (uuid, ObjectId). */
export function decodeCursor(
  value: string | undefined,
  isId: (id: string) => boolean,
): Cursor | null {
  if (!value) {
    return null;
  }
  try {
    const [time, id] = JSON.parse(Buffer.from(value, 'base64url').toString()) as unknown[];
    if (typeof time === 'string' && !Number.isNaN(Date.parse(time)) && typeof id === 'string' && isId(id)) {
      return { time, id };
    }
  } catch {
    // fall through
  }
  throw new BadRequestException('Invalid cursor');
}

/**
 * A page from rows fetched with LIMIT `limit + 1`: the extra row only says
 * there is a next page, which starts after the last item kept.
 */
export function toPage<R>(rows: R[], limit: number, cursorOf: (last: R) => Cursor): Page<R> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
}
