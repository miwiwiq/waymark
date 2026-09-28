import type { Post } from "@/lib/posts";

type Media = Post["media"][number];

// Plain <img>/<video> (decision W4): the signed MinIO links are loaded by the browser directly.
// Every box has its final size and the file's colour before the file arrives, so nothing jumps.

/** The post page: every file at its own aspect ratio, capped at most of the screen height. */
export function MediaGallery({ media, title }: { media: Post["media"]; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      {media.map((item, index) => (
        <div
          key={item.key}
          className="mx-auto max-h-[80vh] w-full overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800"
          style={{
            aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : undefined,
            backgroundColor: item.color,
          }}
        >
          {item.type === "image" ? (
            <img
              src={item.url}
              alt={`${title}, photo ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
              className="h-full w-full object-contain"
            />
          ) : (
            <video src={item.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
          )}
        </div>
      ))}
    </div>
  );
}

/** One file filling a fixed box (grids, the feed carousel). A video shows its first frame. */
export function MediaTile({
  media,
  alt,
  eager = false,
  className = "",
}: {
  media: Media;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-200 dark:bg-neutral-800 ${className}`}
      style={{ backgroundColor: media.color }}
    >
      {media.type === "image" ? (
        <img src={media.url} alt={alt} loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
      ) : (
        <>
          <video src={media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">▶ Video</span>
        </>
      )}
    </div>
  );
}
