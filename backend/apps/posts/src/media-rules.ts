export type MediaKind = 'image' | 'video';

const MB = 1024 * 1024;

/** Decision P2: what can be uploaded, with per-type size limits. */
export const MEDIA_TYPES: Record<string, { kind: MediaKind; extension: string; maxBytes: number }> = {
  'image/jpeg': { kind: 'image', extension: 'jpg', maxBytes: 10 * MB },
  'image/png': { kind: 'image', extension: 'png', maxBytes: 10 * MB },
  'image/webp': { kind: 'image', extension: 'webp', maxBytes: 10 * MB },
  'video/mp4': { kind: 'video', extension: 'mp4', maxBytes: 100 * MB },
  'video/webm': { kind: 'video', extension: 'webm', maxBytes: 100 * MB },
  'video/quicktime': { kind: 'video', extension: 'mov', maxBytes: 100 * MB },
};

export const MAX_MEDIA = 10;

export function describeLimit(kind: MediaKind): string {
  return kind === 'image' ? 'Images can be at most 10 MB' : 'Videos can be at most 100 MB';
}

/** Uploads are namespaced per user, so a post can only use its author's files. */
export function uploadPrefix(userId: string): string {
  return `uploads/${userId}/`;
}
