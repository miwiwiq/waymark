"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logout } from "@/lib/api";
import type { MyProfile } from "@/lib/profile";
import { ThemeSwitch } from "./theme-switch";
import { Avatar, FormError } from "./ui";
import { usePendingRequestCount } from "@/lib/users";

const ITEM = "block w-full rounded-md px-3 py-2 text-left hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-trail dark:hover:bg-neutral-800";

export function AccountMenu({ profile, userId }: { profile?: MyProfile; userId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { data: requests } = usePendingRequestCount();
  const count = requests?.count ?? 0;

  useEffect(() => {
    function closeOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, []);

  function close() {
    setOpen(false);
  }

  async function handleLogout() {
    setPending(true);
    setError(undefined);
    try {
      await logout();
      queryClient.clear();
      router.replace("/login");
    } catch {
      setError("Couldn’t log out. Please try again.");
      setPending(false);
    }
  }

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Account options"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex cursor-pointer items-center gap-1 rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail"
      >
        <Avatar id={userId} username={profile?.username ?? "?"} />
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <div id={panelId} hidden={!open} className="absolute right-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw_-_2rem)] rounded-xl border border-neutral-200 bg-background p-2 shadow-xl dark:border-neutral-800">
        <div className="mb-1 border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
          <p className="truncate font-semibold">{profile?.displayName ?? profile?.username ?? "Your account"}</p>
          {profile?.username && <p className="truncate text-xs opacity-60">@{profile.username}</p>}
        </div>
        {profile?.username && <Link href={`/u/${profile.username}`} onClick={close} className={ITEM}>My profile</Link>}
        <Link
          href="/requests"
          onClick={close}
          className={`${ITEM} inline-flex items-center gap-1.5`}
          aria-label={count > 0 ? `Requests, ${count} pending` : "Requests"}
        >
          Requests
          {count > 0 && (
            <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-700 px-1.5 text-[10px] font-bold tabular-nums text-white dark:bg-orange-400 dark:text-neutral-950">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
        <Link href="/settings" onClick={close} className={ITEM}>Settings</Link>
        <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
          <button type="button" disabled={pending} onClick={() => void handleLogout()} className={`${ITEM} text-red-700 disabled:opacity-50 dark:text-red-400`}>
            {pending ? "Logging out…" : "Log out"}
          </button>
          <FormError message={error} />
        </div>
      </div>
    </div>
  );
}
