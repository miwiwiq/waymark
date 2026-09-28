"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/empty-state";
import { LikeButton } from "@/components/like-button";
import { Location } from "@/components/location";
import { MediaCarousel } from "@/components/media-carousel";
import { Avatar, Button, Page, Skeleton, tint } from "@/components/ui";
import { userColor } from "@/lib/identity";
import { useFeed, type FeedItem } from "@/lib/interactions";
import { formatTripDates } from "@/lib/posts";

/**
 * Own posts and those of accounts the viewer follows, newest first (F2), laid
 * out along a trail: a dashed line with a painted marker per post in the
 * author's colour (W5).
 */
export function Feed() {
  const feed = useFeed();
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;

  // Infinite scroll: load the next page before the end of the list comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || isFetchingNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && void fetchNextPage(),
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (feed.isPending) {
    return (
      <Page width="wide" aria-busy="true">
        <Trail>
          {[0, 1].map((i) => (
            <li key={i} className="flex flex-col gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            </li>
          ))}
        </Trail>
      </Page>
    );
  }
  if (feed.isError) {
    return (
      <Page width="wide" className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="opacity-70">We couldn’t load your feed. {feed.error.message}</p>
        <Button onClick={() => void feed.refetch()}>Try again</Button>
      </Page>
    );
  }

  const items = feed.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <Page width="wide">
        <EmptyState art="trail" title="Your trail starts here">
          <p>Share your first trip, or open a traveller’s profile with the box above and follow them.</p>
          <Link href="/posts/new" className="mt-3 inline-block font-medium text-foreground underline">
            New post
          </Link>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page width="wide">
      <Trail>
        {items.map((item) => (
          <li key={item.id} className="relative">
            <span
              aria-hidden
              className="absolute top-5 -left-6 h-4 w-2.5 rounded-[2px] shadow-sm sm:-left-8"
              style={{ backgroundColor: userColor(item.authorId) }}
            />
            <FeedCard item={item} />
          </li>
        ))}
      </Trail>
      <div ref={sentinel} className="py-8 text-center text-sm">
        {isFetchingNextPage ? (
          <span className="opacity-60">Loading…</span>
        ) : hasNextPage ? null : (
          <span className="inline-flex items-center gap-2 font-display text-base italic opacity-70">
            <span aria-hidden className="h-3 w-1.5 rounded-[1px] bg-trail" />
            End of trail
          </span>
        )}
      </div>
    </Page>
  );
}

/** The dashed line down the left, with room for the markers. */
function Trail({ children }: { children: React.ReactNode }) {
  return (
    <ol className="relative flex flex-col gap-10 pl-8 sm:pl-12">
      <span
        aria-hidden
        className="absolute top-2 bottom-0 left-3 border-l-2 border-dashed border-neutral-300 sm:left-5 dark:border-neutral-700"
      />
      {children}
    </ol>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const href = `/p/${item.id}`;
  return (
    <article
      className="overflow-hidden rounded-xl border border-neutral-200 bg-background dark:border-neutral-800"
      style={tint(item.media[0].color)}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar id={item.authorId} username={item.authorUsername} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/u/${item.authorUsername}`} className="text-sm font-medium hover:underline">
            @{item.authorUsername}
          </Link>
          <Location location={item.location} className="text-xs" />
        </div>
      </header>
      <MediaCarousel post={item} href={href} />
      <div className="flex flex-col gap-2 p-4">
        <Link href={href} className="font-display text-2xl leading-tight font-semibold hover:underline">
          {item.title}
        </Link>
        <p className="text-sm opacity-70">{formatTripDates(item.tripStart, item.tripEnd)}</p>
        {item.caption && <p className="line-clamp-2 text-sm whitespace-pre-line">{item.caption}</p>}
        <div className="flex items-center gap-4 pt-1">
          <LikeButton postId={item.id} stats={item.stats} />
          <Link href={`${href}#comments`} className="text-sm hover:underline">
            {item.stats.commentCount} {item.stats.commentCount === 1 ? "comment" : "comments"}
          </Link>
        </div>
      </div>
    </article>
  );
}
