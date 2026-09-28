"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABELS: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const listeners = new Set<() => void>();

// The choice is a per-browser preference, so it lives in localStorage (W5).
function savedTheme(): Theme {
  try {
    const theme = localStorage.getItem("theme");
    return theme === "light" || theme === "dark" ? theme : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cycles System → Light → Dark. */
export function ThemeSwitch({ labelled = false }: { labelled?: boolean }) {
  const theme = useSyncExternalStore(subscribe, savedTheme, () => "system" as Theme);

  // While on "system", follow the OS when it switches.
  useEffect(() => {
    if (theme !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => apply("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [theme]);

  function choose(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
    apply(next);
    listeners.forEach((listener) => listener());
  }

  return (
    <button
      type="button"
      onClick={() => choose(NEXT[theme])}
      title={`${LABELS[theme]}. Click to change.`}
      aria-label={`${LABELS[theme]}. Click to change.`}
      className={`flex items-center gap-3 rounded-md hover:bg-neutral-200/60 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-trail ${labelled ? "w-full px-3 py-2 text-left" : "p-1.5 opacity-70 hover:opacity-100"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {theme === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {theme === "dark" && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
        {theme === "system" && (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
      {labelled && <span>{LABELS[theme]}</span>}
    </button>
  );
}
