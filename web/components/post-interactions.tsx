"use client";

import { useStats, type Comment, type Stats } from "@/lib/interactions";
import type { Page } from "@/lib/users";
import { Comments } from "./comments";
import { LikeButton } from "./like-button";
import { Skeleton } from "./ui";

/**
 * Likes and comments under a post. They come from Feed Service; if it's down
 * the post still shows, without them (F4).
 */
export function PostInteractions({
  postId,
  initialStats,
  initialComments,
}: {
  postId: string;
  initialStats?: Stats | null;
  initialComments?: Page<Comment> | null;
}) {
  const stats = useStats(postId, initialStats);

  return (
    <section id="comments" className="flex flex-col gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {stats.data ? (
        <div className="flex items-center gap-4">
          <LikeButton postId={postId} stats={stats.data} />
          <span className="text-sm opacity-70">
            {stats.data.commentCount} {stats.data.commentCount === 1 ? "comment" : "comments"}
          </span>
        </div>
      ) : stats.isError ? (
        <p className="text-sm opacity-60">Likes and comments are unavailable right now.</p>
      ) : (
        <Skeleton className="h-5 w-40" />
      )}
      {(stats.data || !stats.isError) && <Comments postId={postId} initial={initialComments} />}
    </section>
  );
}
