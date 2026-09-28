"use client";

import { useEffect, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { USERNAME_PATTERN } from "@/lib/validation";
import { Field, Input } from "./ui";

type Availability =
  | { state: "idle" | "checking" | "available" | "unknown" }
  | { state: "taken"; suggestions: string[] };

/**
 * Checks the name as the user types, like Instagram (decision I8). The answer
 * is advisory: if the check can't run, the user can still submit.
 */
export function UsernameField({
  registration,
  value,
  error,
  onPick,
}: {
  registration: UseFormRegisterReturn;
  value: string;
  error?: string;
  onPick: (username: string) => void;
}) {
  const [result, setResult] = useState<{ username: string; availability: Availability }>();
  const username = value.trim().toLowerCase();
  const valid = USERNAME_PATTERN.test(username);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let availability: Availability;
      try {
        const res = await fetch(
          `/api/users/username-available?username=${encodeURIComponent(username)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { available: boolean; suggestions: string[] };
        availability = body.available
          ? { state: "available" }
          : { state: "taken", suggestions: body.suggestions };
      } catch {
        if (controller.signal.aborted) return;
        availability = { state: "unknown" };
      }
      setResult({ username, availability });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, valid]);

  // Until the answer for the current input arrives, the check counts as running.
  const availability: Availability = !valid
    ? { state: "idle" }
    : result?.username === username
      ? result.availability
      : { state: "checking" };

  return (
    <Field label="Username" required error={error} hint={<AvailabilityHint availability={availability} onPick={onPick} />}>
      <Input {...registration} autoComplete="username" autoCapitalize="none" spellCheck={false} />
    </Field>
  );
}

function AvailabilityHint({
  availability,
  onPick,
}: {
  availability: Availability;
  onPick: (username: string) => void;
}) {
  switch (availability.state) {
    case "checking":
      return <span className="opacity-60">Checking…</span>;
    case "available":
      return <span className="text-green-700 dark:text-green-400">Available</span>;
    case "unknown":
      return <span className="opacity-60">Couldn’t check right now. You can still continue.</span>;
    case "taken":
      return (
        <span className="flex flex-wrap items-center gap-2 text-red-600">
          Taken.
          {availability.suggestions.length > 0 && <span className="opacity-80">Try:</span>}
          {availability.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              {suggestion}
            </button>
          ))}
        </span>
      );
    default:
      return null;
  }
}
