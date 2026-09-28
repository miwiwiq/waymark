"use client";

import Link from "next/link";
import { Page } from "@/components/ui";
import { UserList } from "@/components/user-list";
import { useProfileView, useUserList } from "@/lib/users";

export function FollowList({
  username,
  kind,
}: {
  username: string;
  kind: "followers" | "following";
}) {
  const profile = useProfileView(username);
  const list = useUserList(profile.data ? `/api/users/${profile.data.id}/${kind}` : null);

  return (
    <Page width="wide">
      <h1 className="mb-4 font-display text-3xl font-semibold">
        <Link href={`/u/${username}`} className="hover:underline">
          @{username}
        </Link>{" "}
        · {kind === "followers" ? "Followers" : "Following"}
      </h1>
      {profile.error ? (
        <p className="opacity-70">{profile.error.message}</p>
      ) : (
        <UserList
          query={list}
          empty={kind === "followers" ? "No followers yet." : "Not following anyone yet."}
        />
      )}
    </Page>
  );
}
