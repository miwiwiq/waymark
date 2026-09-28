"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Post } from "@/lib/posts";
import { MediaTile } from "./media-gallery";

/** The feed card's photos: swipe or scroll sideways, arrows on hover, dots for position. */
export function MediaCarousel({ post, href }: { post: Post; href: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = post.media.length;

  function go(to: number) {
    const node = track.current;
    node?.scrollTo({ left: to * node.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="group relative">
      <div
        ref={track}
        onScroll={(event) =>
          setIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))
        }
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {post.media.map((media, i) => (
          <Link key={media.key} href={href} className="w-full shrink-0 snap-center" tabIndex={i === 0 ? 0 : -1}>
            <MediaTile media={media} alt={`${post.title}, ${i + 1} of ${count}`} eager={i === 0} className="aspect-[4/3]" />
          </Link>
        ))}
      </div>
      {count > 1 && (
        <>
          <ArrowButton direction="previous" hidden={index === 0} onClick={() => go(index - 1)} />
          <ArrowButton direction="next" hidden={index === count - 1} onClick={() => go(index + 1)} />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {post.media.map((media, i) => (
              <span
                key={media.key}
                className={`h-1.5 rounded-full bg-white shadow transition-all ${i === index ? "w-4" : "w-1.5 opacity-60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ArrowButton({
  direction,
  hidden,
  onClick,
}: {
  direction: "previous" | "next";
  hidden: boolean;
  onClick: () => void;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "previous" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1 text-lg text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 ${direction === "previous" ? "left-2" : "right-2"}`}
    >
      {direction === "previous" ? "‹" : "›"}
    </button>
  );
}
