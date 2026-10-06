import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { initials, userColor } from "@/lib/identity";

// Two content widths (W5): narrow for forms, wide for content. The header uses the wide one.
const WIDTHS = { narrow: "max-w-lg", wide: "max-w-3xl" };

export function Page({
  width,
  className = "",
  ...props
}: ComponentProps<"main"> & { width: keyof typeof WIDTHS }) {
  return <main {...props} className={`mx-auto w-full ${WIDTHS[width]} px-4 py-6 ${className}`} />;
}

const VARIANTS = {
  primary:
    "bg-neutral-900 text-white enabled:hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:enabled:hover:bg-neutral-300",
  secondary:
    "border border-neutral-300 enabled:hover:bg-neutral-100 dark:border-neutral-700 dark:enabled:hover:bg-neutral-800",
  destructive: "bg-red-700 text-white enabled:hover:bg-red-800",
  ghost: "enabled:hover:bg-neutral-200/60 dark:enabled:hover:bg-neutral-800",
};

type Variant = keyof typeof VARIANTS;

/** Button styles, also for links that act as buttons. Disabled buttons keep their look, faded. */
export function buttonStyles(variant: Variant = "primary", className = ""): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trail disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`;
}

export function Button({ variant, className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} className={buttonStyles(variant, className)} />;
}

export function Field({
  label,
  error,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Marks the label with an asterisk. */
  required?: boolean;
  /** Adds "(optional)" to the label. */
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}
        {required && (
          <span className="text-trail" aria-hidden>
            {" "}
            *
          </span>
        )}
        {optional && <span className="font-normal opacity-60"> (optional)</span>}
      </span>
      {children}
      {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : hint}
    </label>
  );
}

/** The look of text inputs, shared by custom controls. */
export const CONTROL =
  "rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${CONTROL} ${className}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`min-h-24 ${CONTROL}`} />;
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {message}
    </p>
  ) : null;
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page width="narrow" className="flex flex-1 flex-col justify-center">
      <h1 className="mb-6 font-display text-3xl font-semibold">{title}</h1>
      {children}
    </Page>
  );
}

const AVATAR_SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-16 w-16 text-xl",
};

/** Initials on the user's own colour (there are no uploaded avatars, S1). */
export function Avatar({ id, username, size = "md" }: { id: string; username: string; size?: keyof typeof AVATAR_SIZES }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${AVATAR_SIZES[size]}`}
      style={{ backgroundColor: userColor(id) }}
    >
      {initials(username)}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

/** A faint wash of a photo's colour over the page background (theme W5). */
export function tint(color: string | undefined, percent = 10): CSSProperties | undefined {
  return color ? { backgroundColor: `color-mix(in srgb, ${color} ${percent}%, var(--background))` } : undefined;
}
