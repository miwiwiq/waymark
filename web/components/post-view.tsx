import Link from "next/link";
import type { Comment, Stats } from "@/lib/interactions";
import { formatTripDates, type Post } from "@/lib/posts";
import type { Page as ListPage } from "@/lib/users";
import { Location } from "./location";
import { MediaGallery } from "./media-gallery";
import { PostInteractions } from "./post-interactions";
import { PostOwnerActions } from "./post-owner-actions";
import { Avatar, Page } from "./ui";

/**
 * Renders on the server for public posts, with their counts and first
 * comments, and in the browser for private ones (W3). The top of the page
 * takes a wash of the cover's colour (W5).
 */
export function PostView({
  post,
  initialStats,
  initialComments,
}: {
  post: Post;
  initialStats?: Stats | null;
  initialComments?: ListPage<Comment> | null;
}) {
  const color = post.media[0]?.color;
  return (
    <div
      className="flex flex-1 flex-col"
      style={
        color
          ? { backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${color} 14%, transparent), transparent 360px)` }
          : undefined
      }
    >
      <Page width="wide">
        <article className="flex flex-col gap-5">
          {post.isArchived && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Archived. Only you can see this post.
            </p>
          )}
          <header className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{post.title}</h1>
              <PostOwnerActions post={post} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link href={`/u/${post.authorUsername}`} className="flex items-center gap-2 font-medium hover:underline">
                <Avatar id={post.authorId} username={post.authorUsername} size="sm" />@{post.authorUsername}
              </Link>
              <Location location={post.location} />
              <span className="opacity-70">{formatTripDates(post.tripStart, post.tripEnd)}</span>
            </div>
          </header>
          {post.caption && <p className="text-lg leading-relaxed whitespace-pre-line">{post.caption}</p>}
          <MediaGallery media={post.media} title={post.title} />
          <PostInteractions postId={post.id} initialStats={initialStats} initialComments={initialComments} />
        </article>
      </Page>
    </div>
  );
}
