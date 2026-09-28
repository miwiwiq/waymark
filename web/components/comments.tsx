"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { apiFetch } from "@/lib/api";
import { useComments, type Comment } from "@/lib/interactions";
import { useSession } from "@/lib/session";
import type { Page } from "@/lib/users";
import { Avatar, Button, FormError, Skeleton, Textarea } from "./ui";

const MAX_LENGTH = 1000;

// UTC dates, so the server and the browser render the same text.
const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Comments({ postId, initial }: { postId: string; initial?: Page<Comment> | null }) {
  const comments = useComments(postId, initial);
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
      queryClient.invalidateQueries({ queryKey: ["stats", postId] }),
    ]);

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/interactions/comments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteId(null);
      return refresh();
    },
  });

  if (!comments.data) {
    return comments.isError ? (
      <p className="text-sm opacity-60">Comments are unavailable right now.</p>
    ) : (
      // Holds the space until the comments arrive, so the page doesn't jump.
      <div aria-busy="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const items = comments.data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-4">
      {status === "authenticated" && <CommentForm postId={postId} onAdded={refresh} />}
      {status === "anonymous" && (
        <p className="text-sm opacity-70">
          <Link href="/login" className="font-medium underline">
            Log in
          </Link>{" "}
          to like and comment.
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm opacity-60">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((comment) => (
            <li key={comment.id} className="flex gap-3 text-sm">
              <Avatar id={comment.authorId} username={comment.authorUsername} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0">
                    <Link href={`/u/${comment.authorUsername}`} className="font-medium hover:underline">
                      @{comment.authorUsername}
                    </Link>{" "}
                    <time dateTime={comment.createdAt} className="opacity-60">
                      {dateFormat.format(new Date(comment.createdAt))}
                    </time>
                  </p>
                  {comment.authorId === viewerId && (
                    <button
                      type="button"
                      onClick={() => {
                        remove.reset();
                        setDeleteId(comment.id);
                      }}
                      disabled={remove.isPending}
                      className="text-xs opacity-60 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line break-words">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this comment?"
        description="Your comment will be permanently deleted. This can’t be undone."
        confirmLabel="Delete comment"
        pendingLabel="Deleting…"
        pending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); }}
        onClose={() => setDeleteId(null)}
      />
      {comments.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
          className="self-center"
        >
          Older comments
        </Button>
      )}
    </div>
  );
}

function CommentForm({ postId, onAdded }: { postId: string; onAdded: () => Promise<unknown> }) {
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: (text: string) =>
      apiFetch<Comment>(`/api/interactions/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      }),
    onSuccess: async () => {
      setBody("");
      await onAdded();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (body.trim()) add.mutate(body);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_LENGTH}
        placeholder="Add a comment…"
        aria-label="Comment"
        rows={2}
      />
      <FormError message={add.error?.message} />
      <Button type="submit" disabled={add.isPending || !body.trim()} className="self-end">
        Post comment
      </Button>
    </form>
  );
}
