"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Stats } from "@/lib/interactions";
import { useSession } from "@/lib/session";

export function LikeButton({ postId, stats }: { postId: string; stats: Stats }) {
  const status = useSession((s) => s.status);
  // Shows the click at once; fresh stats from the parent replace it.
  const [shown, setShown] = useState(stats);
  const [source, setSource] = useState(stats);
  if (stats !== source) {
    setSource(stats);
    setShown(stats);
  }

  const toggle = useMutation({
    mutationFn: (like: boolean) =>
      apiFetch<Stats>(`/api/interactions/posts/${postId}/like`, { method: like ? "PUT" : "DELETE" }),
    onMutate: (like) =>
      setShown((s) => ({ ...s, likedByMe: like, likeCount: s.likeCount + (like ? 1 : -1) })),
    onSuccess: setShown,
    onError: () => setShown(source),
  });

  const label = `${shown.likeCount} ${shown.likeCount === 1 ? "like" : "likes"}`;
  if (status === "loading") {
    return <span className="text-sm">♡ {label}</span>;
  }
  if (status === "anonymous") {
    return (
      <Link href="/login" className="text-sm hover:underline" title="Log in to like">
        ♡ {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={shown.likedByMe}
      onClick={() => toggle.mutate(!shown.likedByMe)}
      disabled={toggle.isPending}
      className="text-sm hover:underline disabled:opacity-60"
    >
      <span className={`inline-block transition-transform ${shown.likedByMe ? "scale-110 text-red-600" : ""}`}>
        {shown.likedByMe ? "♥" : "♡"}
      </span>{" "}
      {label}
    </button>
  );
}
