"use client";

import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Avatar, Skeleton, buttonStyles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useProfileView, type ProfileView } from "@/lib/users";

export function ProfileHeader({ username }: { username: string }) {
  const { data: profile, error, isPending } = useProfileView(username);

  if (isPending) {
    return (
      <div aria-busy="true" className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-12 text-center opacity-70">
        {error instanceof ApiError && error.status === 404
          ? "This account doesn’t exist."
          : error.message}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar id={profile.id} username={profile.username} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold">{profile.displayName ?? `@${profile.username}`}</h1>
            {profile.displayName && <p className="opacity-70">@{profile.username}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {profile.relationship === "self" && (
            <Link href="/archive" className={buttonStyles("secondary")}>
              Archive
            </Link>
          )}
          <FollowButton profile={profile} />
        </div>
      </div>
      {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
      <Counts profile={profile} />
      {!profile.canViewContent && (
        <p className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          {profile.relationship === "requested"
            ? "Your follow request is pending. You’ll see this account’s travel logs once it’s accepted."
            : "This account is private. Follow it to see its travel logs."}
        </p>
      )}
    </section>
  );
}

// Private profiles show their counts to everyone, but the lists only to followers (G3).
function Counts({ profile }: { profile: ProfileView }) {
  const followers = `${profile.followerCount} ${profile.followerCount === 1 ? "follower" : "followers"}`;
  const following = `${profile.followingCount} following`;
  if (!profile.canViewContent) {
    return (
      <p className="flex gap-4 text-sm opacity-70">
        <span>{followers}</span>
        <span>{following}</span>
      </p>
    );
  }
  return (
    <p className="flex gap-4 text-sm">
      <Link href={`/u/${profile.username}/followers`} className="hover:underline">
        {followers}
      </Link>
      <Link href={`/u/${profile.username}/following`} className="hover:underline">
        {following}
      </Link>
    </p>
  );
}
