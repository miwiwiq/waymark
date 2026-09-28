import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch, withCursor } from "./api";
import { useSession } from "./session";

export type Relationship = "self" | "none" | "requested" | "following";

/** A profile as another user sees it; the header is public even for private accounts (G3). */
export type ProfileView = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  relationship: Relationship;
  canViewContent: boolean;
};

export type UserSummary = { id: string; username: string; displayName: string | null };
export type Page<T> = { items: T[]; nextCursor: string | null };

export function useProfileView(username: string) {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useQuery({
    queryKey: ["profile", "view", username, viewerId],
    queryFn: () =>
      apiFetch<ProfileView>(`/api/users/by-username/${encodeURIComponent(username)}`),
    // Wait for the session check, or a logged-in viewer would briefly look like a stranger.
    enabled: status !== "loading",
    retry: false,
  });
}

/** Followers, following or follow requests, one page of 20 at a time. */
export function useUserList(path: string | null) {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useInfiniteQuery({
    queryKey: ["users", "list", path, viewerId],
    // Only runs once `path` is set (see `enabled`).
    queryFn: ({ pageParam }) => apiFetch<Page<UserSummary>>(withCursor(path!, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: path !== null && status !== "loading",
    retry: false,
  });
}

/** Header notification count, isolated per signed-in account. */
export function usePendingRequestCount() {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  return useQuery({
    queryKey: ["users", "requests-count", userId],
    queryFn: () => apiFetch<{ count: number }>("/api/users/me/requests/count"),
    enabled: status === "authenticated",
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
