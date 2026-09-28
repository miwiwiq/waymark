import { decodeCursor, encodeCursor, type Page } from '@app/common';
import { isMongoId } from 'class-validator';
import { mergeFirstPage, newestFirst } from './merge.js';

type TestPost = { id: string; authorId: string; createdAt: string };

const LIMIT = 20;

function post(n: number, authorId: string, second: number): TestPost {
  return {
    id: n.toString(16).padStart(24, '0'),
    authorId,
    createdAt: new Date(Date.UTC(2026, 8, 1, 12, 0, second)).toISOString(),
  };
}

/** Stands in for Post Service's internal query: newest first, older than the cursor. */
function query(posts: TestPost[], authorIds: string[], cursorParam?: string): Page<TestPost> {
  const cursor = decodeCursor(cursorParam, isMongoId);
  const rows = posts
    .filter((p) => authorIds.includes(p.authorId))
    .filter((p) => !cursor || newestFirst(p, { id: cursor.id, createdAt: cursor.time }) > 0)
    .sort(newestFirst)
    .slice(0, LIMIT + 1);
  const items = rows.slice(0, LIMIT);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > LIMIT && last ? encodeCursor({ time: last.createdAt, id: last.id }) : null,
  };
}

/** The whole feed, paged the way FeedService does it: merged page 1, then single queries. */
function readFeed(posts: TestPost[], popular: string[], others: string[]): TestPost[] {
  const first = mergeFirstPage(
    [query(posts, others), ...popular.map((author) => query(posts, [author]))],
    LIMIT,
  );
  const seen = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = query(posts, [...popular, ...others], cursor);
    seen.push(...page.items);
    cursor = page.nextCursor;
  }
  return seen;
}

describe('newestFirst', () => {
  it('orders by time, then by id for posts created in the same instant', () => {
    const [a, b, c] = [post(1, 'x', 5), post(2, 'x', 5), post(3, 'x', 9)];
    expect([a, b, c].sort(newestFirst)).toEqual([c, b, a]);
  });
});

describe('mergeFirstPage', () => {
  it('interleaves sources and has no next page when everything fits', () => {
    const page = mergeFirstPage(
      [
        { items: [post(3, 'a', 30), post(1, 'a', 10)], nextCursor: null },
        { items: [post(2, 'b', 20)], nextCursor: null },
      ],
      LIMIT,
    );
    expect(page.items.map((p) => p.id)).toEqual([3, 2, 1].map((n) => post(n, '', 0).id));
    expect(page.nextCursor).toBeNull();
  });

  it('has a next page when a source is cut off, even if the page is exactly full', () => {
    const full = Array.from({ length: LIMIT }, (_, i) => post(i + 1, 'a', i));
    const page = mergeFirstPage([{ items: full, nextCursor: 'more' }], LIMIT);
    expect(page.items).toHaveLength(LIMIT);
    expect(decodeCursor(page.nextCursor!, isMongoId)).toEqual({
      time: page.items.at(-1)!.createdAt,
      id: page.items.at(-1)!.id,
    });
  });
});

describe('paging a fixed dataset', () => {
  const authors = ['viewer', 'popular-1', 'popular-2', 'friend-1', 'friend-2'];
  // 150 posts; many share a timestamp, so ties must be broken by id.
  const posts = Array.from({ length: 150 }, (_, i) => post(i + 1, authors[(i * 7) % 5], (i * 13) % 40));
  const expected = [...posts].sort(newestFirst).map((p) => p.id);

  it('returns every post exactly once, in order', () => {
    const ids = readFeed(posts, ['popular-1', 'popular-2'], ['viewer', 'friend-1', 'friend-2']).map((p) => p.id);
    expect(ids).toEqual(expected);
  });

  it('works when one popular author fills the whole first page', () => {
    const burst = Array.from({ length: 30 }, (_, i) => post(1000 + i, 'popular-1', 59));
    const all = [...posts, ...burst];
    const ids = readFeed(all, ['popular-1', 'popular-2'], ['viewer', 'friend-1', 'friend-2']).map((p) => p.id);
    expect(ids).toEqual([...all].sort(newestFirst).map((p) => p.id));
  });

  it('works with no popular authors at all', () => {
    const ids = readFeed(posts, [], authors).map((p) => p.id);
    expect(ids).toEqual(expected);
  });
});
