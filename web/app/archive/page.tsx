"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PostGrid } from "@/components/post-grid";
import { ProfileGate } from "@/components/profile-gate";
import { EmptyState } from "@/components/empty-state";
import { Button, Page } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useArchivedPosts, type Post } from "@/lib/posts";

export default function ArchivePage() {
  return <ProfileGate>{() => <Archive />}</ProfileGate>;
}

function Archive() {
  const posts = useArchivedPosts();
  return (
    <Page width="wide">
      <h1 className="mb-1 font-display text-3xl font-semibold">Archive</h1>
      <p className="mb-6 text-sm opacity-70">Archived posts are hidden from everyone but you.</p>
      <PostGrid
        query={posts}
        empty={
          <EmptyState art="archive" title="Nothing archived">
            Archive a post from its page to hide it without deleting it.
          </EmptyState>
        }
        actions={(post) => <UnarchiveButton post={post} />}
      />
    </Page>
  );
}

function UnarchiveButton({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const unarchive = useMutation({
    mutationFn: () => apiFetch(`/api/posts/${post.id}/unarchive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  return (
    <Button variant="secondary" onClick={() => unarchive.mutate()} disabled={unarchive.isPending}>
      Unarchive
    </Button>
  );
}
