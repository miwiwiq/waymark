"use client";

import { PostGrid } from "@/components/post-grid";
import { useAuthorPosts } from "@/lib/posts";
import { useProfileView } from "@/lib/users";

/** The profile's travel logs, for whoever may see them (G3). */
export function ProfilePosts({ username }: { username: string }) {
  const profile = useProfileView(username);
  const visible = profile.data?.canViewContent ? profile.data.id : null;
  const posts = useAuthorPosts(visible);

  if (!visible) {
    return null; // the header already explains why
  }
  return (
    <section className="mt-8">
      <PostGrid query={posts} empty="No travel logs yet." />
    </section>
  );
}
