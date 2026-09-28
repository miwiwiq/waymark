"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { ProfileView, Relationship } from "@/lib/users";
import { Button, buttonStyles } from "./ui";

const LABELS: Record<Exclude<Relationship, "self">, string> = {
  none: "Follow",
  requested: "Requested",
  following: "Following",
};

export function FollowButton({ profile }: { profile: ProfileView }) {
  const status = useSession((s) => s.status);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const path = `/api/users/${profile.id}/follow`;
      if (profile.relationship === "none") {
        await apiFetch(path, { method: "POST" });
      } else {
        await apiFetch(path, { method: "DELETE" }); // unfollow, or cancel the request
      }
    },
    onSuccess: () => {
      setConfirmOpen(false);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", "view"] }),
        queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
      ]);
    },
  });

  if (profile.relationship === "self") {
    return (
      <Link href="/settings" className={buttonStyles("secondary")}>
        Edit profile
      </Link>
    );
  }
  if (status !== "authenticated") {
    return (
      <Link href="/login" className={buttonStyles("primary")}>
        Follow
      </Link>
    );
  }

  function handleClick() {
    if (profile.relationship === "following") {
      mutation.reset();
      setConfirmOpen(true);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleClick}
        disabled={mutation.isPending}
        title={profile.relationship === "requested" ? "Cancel request" : undefined}
        variant={profile.relationship === "none" ? "primary" : "secondary"}
      >
        {LABELS[profile.relationship]}
      </Button>
      {!confirmOpen && mutation.error && <span className="text-xs text-red-600">{mutation.error.message}</span>}
      <ConfirmDialog
        open={confirmOpen}
        title={`Unfollow @${profile.username}?`}
        description={profile.isPrivate
          ? "You’ll need to send another follow request to see their travel logs again."
          : "Their travel logs will no longer appear in your feed."}
        confirmLabel="Unfollow"
        pendingLabel="Unfollowing…"
        pending={mutation.isPending}
        error={mutation.error?.message}
        onConfirm={() => mutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
