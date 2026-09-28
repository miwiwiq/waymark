"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { countryFlag, countryName } from "@/lib/countries";
import type { Post, useArchivedPosts } from "@/lib/posts";
import { MediaTile } from "./media-gallery";
import { Button, Skeleton } from "./ui";

export function PostGrid({
  query,
  empty,
  actions,
}: {
  query: ReturnType<typeof useArchivedPosts>;
  /** Shown when there are no posts. */
  empty: ReactNode;
  actions?: (post: Post) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <ul aria-busy="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="aspect-square w-full rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return <p className="text-red-600 dark:text-red-400">{query.error.message}</p>;
  }

  const posts = query.data.pages.flatMap((page) => page.items);
  if (posts.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id} className="flex flex-col gap-2">
            <Link href={`/p/${post.id}`} className="block overflow-hidden rounded-lg">
              <MediaTile
                media={post.media[0]}
                alt={post.title}
                className="aspect-square transition-transform duration-300 hover:scale-[1.03]"
              />
            </Link>
            <div className="min-w-0 text-sm">
              <Link href={`/p/${post.id}`} className="block truncate font-display text-base font-semibold hover:underline">
                {post.title}
              </Link>
              <span className="block truncate opacity-70">
                {countryFlag(post.location.country)} {post.location.city}, {countryName(post.location.country)}
              </span>
            </div>
            {actions?.(post)}
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="self-center"
        >
          Load more
        </Button>
      )}
    </div>
  );
}
