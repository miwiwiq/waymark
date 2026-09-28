import { encodeCursor, type Page } from '@app/common';

type Sortable = { id: string; createdAt: string };

const compare = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

/**
 * Newest first, ties broken by id: the order of Post Service's index (F2).
 * createdAt is always a UTC ISO string and ids are same-length hex, so plain
 * string comparison is chronological.
 */
export function newestFirst(a: Sortable, b: Sortable): number {
  return compare(b.createdAt, a.createdAt) || compare(b.id, a.id);
}

/**
 * Page 1 of a feed from several newest-first sources, each holding at most
 * `limit` posts (F3). The merged first `limit` posts are exact: a post a
 * source left out is older than all `limit` posts it returned. There is a next
 * page when posts are left over or a source says it has more.
 */
export function mergeFirstPage<T extends Sortable>(sources: Page<T>[], limit: number): Page<T> {
  const merged = sources.flatMap((source) => source.items).sort(newestFirst);
  const items = merged.slice(0, limit);
  const last = items.at(-1);
  const more = merged.length > limit || sources.some((source) => source.nextCursor !== null);
  return {
    items,
    nextCursor: more && last ? encodeCursor({ time: last.createdAt, id: last.id }) : null,
  };
}
