"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostForm } from "@/components/post-form";
import { ProfileGate } from "@/components/profile-gate";
import { Page } from "@/components/ui";
import { usePost } from "@/lib/posts";

export default function EditPostPage() {
  return <ProfileGate>{(profile) => <EditPost userId={profile.id} />}</ProfileGate>;
}

function EditPost({ userId }: { userId: string }) {
  const { id } = useParams<{ id: string }>();
  const post = usePost(id);
  const queryClient = useQueryClient();
  const router = useRouter();

  if (post.isPending) {
    return (
      <Page width="narrow">
        <p className="opacity-60">Loading…</p>
      </Page>
    );
  }
  if (post.isError || post.data.authorId !== userId) {
    return (
      <Page width="narrow" className="text-center opacity-70">
        This post isn’t available.
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <Link href={`/p/${id}`} className="text-sm opacity-70 hover:underline">
        ← Back to the post
      </Link>
      <h1 className="mt-2 mb-6 font-display text-3xl font-semibold">Edit travel log</h1>
      <PostForm
        post={post.data}
        cancelHref={`/p/${id}`}
        onSaved={async (saved) => {
          await queryClient.invalidateQueries({ queryKey: ["post", saved.id] });
          await queryClient.invalidateQueries({ queryKey: ["posts"] });
          router.push(`/p/${saved.id}`);
          router.refresh();
        }}
      />
    </Page>
  );
}
