import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch, withCursor } from "./api";
import type { Post } from "./posts";
import { useSession } from "./session";
import type { Page } from "./users";

export type Stats = { likeCount: number; commentCount: number; likedByMe: boolean };

export type Comment = {
  id: string;
  authorId: string;
  authorUsername: string;
  body: string;
  createdAt: string;
};

export type FeedItem = Post & { stats: Stats };

export function useFeed() {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useInfiniteQuery({
    queryKey: ["feed", viewerId],
    queryFn: ({ pageParam }) => apiFetch<Page<FeedItem>>(withCursor("/api/feed", pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: status === "authenticated",
    retry: false,
  });
}

/**
 * Counts, plus whether the viewer liked the post. `initial` is what the server
 * rendered as an anonymous visitor; the browser always refetches to add the
 * personal part (W3).
 */
export function useStats(postId: string, initial?: Stats | null) {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useQuery({
    queryKey: ["stats", postId, viewerId],
    queryFn: () => apiFetch<Stats>(`/api/interactions/posts/${postId}/stats`),
    initialData: initial ?? undefined,
    enabled: status !== "loading",
    retry: false,
  });
}

/** Newest first. */
export function useComments(postId: string, initial?: Page<Comment> | null) {
  const status = useSession((s) => s.status);
  return useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: ({ pageParam }) =>
      apiFetch<Page<Comment>>(withCursor(`/api/interactions/posts/${postId}/comments`, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: initial ? { pages: [initial], pageParams: [null] } : undefined,
    enabled: status !== "loading",
    retry: false,
  });
}
