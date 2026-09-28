import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch, withCursor } from "./api";
import { useSession } from "./session";
import type { Page } from "./users";

export type MediaKind = "image" | "video";

export type Post = {
  id: string;
  authorId: string;
  authorUsername: string;
  title: string;
  caption: string;
  location: { country: string; city: string; lat?: number; lng?: number };
  tripStart: string;
  tripEnd: string;
  /** `url` is a signed link valid for an hour (P3); colour and size drive placeholders (P2). */
  media: { key: string; type: MediaKind; url: string; color?: string; width?: number; height?: number }[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

const MB = 1024 * 1024;

/** Same limits as the API (P2), checked here first so users hear about them before uploading. */
export const MEDIA_RULES: Record<string, { kind: MediaKind; maxBytes: number; extensions: string[] }> = {
  "image/jpeg": { kind: "image", maxBytes: 10 * MB, extensions: [".jpg", ".jpeg"] },
  "image/png": { kind: "image", maxBytes: 10 * MB, extensions: [".png"] },
  "image/webp": { kind: "image", maxBytes: 10 * MB, extensions: [".webp"] },
  "video/mp4": { kind: "video", maxBytes: 100 * MB, extensions: [".mp4"] },
  "video/webm": { kind: "video", maxBytes: 100 * MB, extensions: [".webm"] },
  "video/quicktime": { kind: "video", maxBytes: 100 * MB, extensions: [".mov"] },
};

export const MAX_MEDIA = 10;

/**
 * Uploads straight to MinIO with pre-signed URLs (P2) and returns the object
 * keys. `onProgress` gets the bytes sent so far across all files.
 */
export async function uploadFiles(files: File[], onProgress?: (sent: number) => void): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }
  const targets = await apiFetch<{ key: string; uploadUrl: string }[]>("/api/posts/uploads", {
    method: "POST",
    body: JSON.stringify({
      files: files.map((file) => ({ contentType: file.type, size: file.size })),
    }),
  });
  const sent = files.map(() => 0);
  await Promise.all(
    files.map((file, index) =>
      put(targets[index].uploadUrl, file, (bytes) => {
        sent[index] = bytes;
        onProgress?.(sent.reduce((total, part) => total + part, 0));
      }),
    ),
  );
  return targets.map((target) => target.key);
}

// fetch can't report upload progress, so the PUT goes through XMLHttpRequest.
function put(url: string, file: File, onProgress: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    // The Content-Type must match the one in the signature.
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
      } else {
        reject(new Error(`Uploading ${file.name} failed (${request.status})`));
      }
    };
    request.onerror = () => reject(new Error(`Uploading ${file.name} failed`));
    request.send(file);
  });
}

export function usePost(id: string) {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useQuery({
    queryKey: ["post", id, viewerId],
    queryFn: () => apiFetch<Post>(`/api/posts/${id}`),
    enabled: status !== "loading",
    retry: false,
  });
}

function usePostPages(key: string[], path: string | null) {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  return useInfiniteQuery({
    queryKey: ["posts", ...key, viewerId],
    // Only runs once `path` is set (see `enabled`).
    queryFn: ({ pageParam }) => apiFetch<Page<Post>>(withCursor(path!, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: path !== null && status !== "loading",
    retry: false,
  });
}

export function useAuthorPosts(authorId: string | null) {
  return usePostPages(["author", authorId ?? ""], authorId ? `/api/posts?authorId=${authorId}` : null);
}

export function useArchivedPosts() {
  return usePostPages(["archived"], "/api/posts/archived");
}

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAY_MS = 24 * 60 * 60 * 1000;

/** "May 1 – 3, 2026 · 3 days": both ends count, so a one-day trip is "1 day". */
export function formatTripDates(start: string, end: string): string {
  const [from, to] = [start, end].map((date) => new Date(`${date}T00:00:00Z`));
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  return `${dateFormat.formatRange(from, to)} · ${days} ${days === 1 ? "day" : "days"}`;
}

/** "38.72°N 9.14°W" */
export function formatCoordinates(lat: number, lng: number): string {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
  return `${part(lat, "N", "S")} ${part(lng, "E", "W")}`;
}
