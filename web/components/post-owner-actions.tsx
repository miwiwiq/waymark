"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Post } from "@/lib/posts";
import { useSession } from "@/lib/session";
import { Button, buttonStyles } from "./ui";

/** Edit and archive buttons, shown in the browser to the author only. Edit is the everyday action, so it leads. */
export function PostOwnerActions({ post }: { post: Post }) {
  const userId = useSession((s) => s.userId);
  const queryClient = useQueryClient();
  const router = useRouter();

  const toggleArchive = useMutation({
    mutationFn: () =>
      apiFetch<Post>(`/api/posts/${post.id}/${post.isArchived ? "unarchive" : "archive"}`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      // The server-rendered version depends on whether the post is public.
      router.refresh();
    },
  });

  if (userId !== post.authorId) {
    return null;
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Link href={`/posts/${post.id}/edit`} className={buttonStyles("primary")}>
        Edit
      </Link>
      <Button variant="secondary" onClick={() => toggleArchive.mutate()} disabled={toggleArchive.isPending}>
        {post.isArchived ? "Unarchive" : "Archive"}
      </Button>
    </div>
  );
}
