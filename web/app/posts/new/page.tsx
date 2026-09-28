"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PostForm } from "@/components/post-form";
import { ProfileGate } from "@/components/profile-gate";
import { Page } from "@/components/ui";

export default function NewPostPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return (
    <ProfileGate>
      {() => (
        <Page width="narrow">
          <h1 className="mb-6 font-display text-3xl font-semibold">New travel log</h1>
          <PostForm
            cancelHref="/"
            onSaved={async (post) => {
              await queryClient.invalidateQueries({ queryKey: ["posts"] });
              router.push(`/p/${post.id}`);
            }}
          />
        </Page>
      )}
    </ProfileGate>
  );
}
