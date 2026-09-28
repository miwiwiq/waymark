"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMyProfile, type MyProfile } from "@/lib/profile";
import { useRequireSession } from "@/lib/session-guards";
import { Button, Page, Skeleton } from "./ui";

/**
 * Wraps pages that need a logged-in user with a finished profile. While the
 * profile is being created after signup it shows a skeleton; incomplete
 * profiles go to /onboarding (decision I7), which renders with `onboarding`.
 */
export function ProfileGate({
  onboarding = false,
  children,
}: {
  onboarding?: boolean;
  children: (profile: MyProfile) => ReactNode;
}) {
  const status = useRequireSession();
  const profile = useMyProfile();
  const router = useRouter();
  const complete = profile.data?.complete;

  useEffect(() => {
    if (complete === false && !onboarding) router.replace("/onboarding");
    if (complete === true && onboarding) router.replace("/");
  }, [complete, onboarding, router]);

  if (status !== "authenticated" || profile.isPending) {
    return <ProfileSkeleton />;
  }
  if (profile.isError) {
    return (
      <Page width="narrow" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-2xl font-semibold">We couldn’t load your profile</h1>
        <p className="opacity-70">
          If you just signed up, it may still be being set up. Try again in a moment.
        </p>
        <Button onClick={() => void profile.refetch()}>Try again</Button>
      </Page>
    );
  }
  if (profile.data.complete === onboarding) {
    return <ProfileSkeleton />; // redirecting
  }
  return children(profile.data);
}

function ProfileSkeleton() {
  return (
    <Page width="wide" aria-busy="true" className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-40" />
    </Page>
  );
}
