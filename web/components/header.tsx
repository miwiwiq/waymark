"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountMenu } from "./account-menu";
import { useMyProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { USERNAME_PATTERN } from "@/lib/validation";
import { ThemeSwitch } from "./theme-switch";
import { buttonStyles } from "./ui";

export function Header() {
  const status = useSession((s) => s.status);
  const { data: profile } = useMyProfile();
  const userId = useSession((s) => s.userId);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-background/80 backdrop-blur-md dark:border-neutral-800/70">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          {/* A painted waymark: the stripe on a tree that shows hikers the trail. */}
          <span aria-hidden className="h-4 w-2 rounded-[2px] bg-trail" />
          Waymark
        </Link>
        <GoToProfile />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {status === "authenticated" && (
            <>
              <Link href="/posts/new" className={buttonStyles("primary", "shrink-0 hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail dark:hover:bg-neutral-300")}>
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                New post
              </Link>
              {userId && <AccountMenu key={`${userId}:${pathname}`} profile={profile} userId={userId} />}
            </>
          )}
          {status === "anonymous" && (
            <>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link href="/register" className="hover:underline">
                Sign up
              </Link>
            </>
          )}
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
}

// Not search (out of scope): it only opens the profile with that exact username.
// "/" focuses it from anywhere outside a text field.
function GoToProfile() {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const username = value.trim().replace(/^@/, "").toLowerCase();
    if (USERNAME_PATTERN.test(username)) {
      router.push(`/u/${username}`);
      setValue("");
      input.current?.blur();
    }
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="relative order-last w-full sm:order-none sm:w-auto">
      <input
        ref={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Go to @username"
        aria-label="Go to a profile by username (shortcut: /)"
        autoCapitalize="none"
        spellCheck={false}
        className="peer w-full rounded-md border border-neutral-300 bg-transparent py-1.5 pr-8 pl-3 text-sm outline-none focus:border-neutral-900 sm:w-52 dark:border-neutral-700 dark:focus:border-neutral-100"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-neutral-300 px-1.5 font-mono text-[10px] opacity-60 peer-focus:hidden dark:border-neutral-700">
        /
      </kbd>
    </form>
  );
}
