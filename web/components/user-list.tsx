"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { useUserList, UserSummary } from "@/lib/users";
import { Avatar, Button } from "./ui";

export function UserList({
  query,
  empty,
  actions,
}: {
  query: ReturnType<typeof useUserList>;
  empty: string;
  actions?: (user: UserSummary) => ReactNode;
}) {
  if (query.isPending) {
    return <p className="opacity-60">Loading…</p>;
  }
  if (query.isError) {
    return <p className="text-red-600">{query.error.message}</p>;
  }

  const users = query.data.pages.flatMap((page) => page.items);
  if (users.length === 0) {
    return <p className="opacity-60">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-4 py-3">
            <Link href={`/u/${user.username}`} className="flex min-w-0 items-center gap-3">
              <Avatar id={user.id} username={user.username} />
              <span className="min-w-0">
                <span className="block truncate font-medium">@{user.username}</span>
                {user.displayName && (
                  <span className="block truncate text-sm opacity-70">{user.displayName}</span>
                )}
              </span>
            </Link>
            {actions?.(user)}
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="self-center"
        >
          Load more
        </Button>
      )}
    </div>
  );
}
