"use client";

import { PostView } from "@/components/post-view";
import { Page, Skeleton } from "@/components/ui";
import { usePost } from "@/lib/posts";

/**
 * Posts an anonymous visitor can't see (private or archived) load here with the
 * viewer's token, so followers and the author still see them (W3).
 */
export function PrivatePost({ id }: { id: string }) {
  const post = usePost(id);

  if (post.isPending) {
    return (
      <Page width="wide" aria-busy="true" className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      </Page>
    );
  }
  if (post.isError) {
    return (
      <Page width="wide" className="py-12 text-center opacity-70">
        This post isn’t available. It may be private or archived.
      </Page>
    );
  }
  return <PostView post={post.data} />;
}
