import type { Metadata } from "next";
import { cache } from "react";
import { PostView } from "@/components/post-view";
import { countryName } from "@/lib/countries";
import type { Comment, Stats } from "@/lib/interactions";
import type { Post } from "@/lib/posts";
import type { Page } from "@/lib/users";
import { PrivatePost } from "./private-post";

const API = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

// Fetched as an anonymous visitor: the server renders only what anyone may see (W3).
const getPublicPost = cache(async (id: string): Promise<Post | null> => {
  const res = await fetch(`${API}/api/posts/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) {
    return null; // private, archived, or missing
  }
  if (!res.ok) {
    throw new Error(`Posts service answered ${res.status}`);
  }
  return (await res.json()) as Post;
});

/** Counts and comments are optional: without Feed Service the post still renders (F4). */
async function getInteractions<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api/interactions/posts/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(id).catch(() => null);
  if (!post) {
    return { title: "Waymark", robots: { index: false } };
  }
  const description =
    post.caption.slice(0, 160) || `A travel log by @${post.authorUsername}`;
  const cover = post.media.find((media) => media.type === "image");
  return {
    title: `${post.title} · ${post.location.city}, ${countryName(post.location.country)} | Waymark`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      // A signed link, valid for an hour (L3).
      images: cover ? [cover.url] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const path = encodeURIComponent(id);
  const [post, stats, comments] = await Promise.all([
    getPublicPost(id),
    getInteractions<Stats>(`${path}/stats`),
    getInteractions<Page<Comment>>(`${path}/comments`),
  ]);
  return post ? (
    <PostView post={post} initialStats={stats} initialComments={comments} />
  ) : (
    <PrivatePost id={id} />
  );
}
