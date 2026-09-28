import type { ReactNode } from "react";

const ART = {
  // A dashed trail winding up to a flag.
  trail: (
    <>
      <path d="M12 70c14-4 18-16 34-18s22 8 36-2 10-24 26-30" strokeDasharray="4 5" />
      <path d="M108 20V4l12 5-12 5" />
      <rect x="27" y="56" width="4" height="7" rx="1" className="fill-trail stroke-none" />
      <rect x="64" y="50" width="4" height="7" rx="1" className="fill-trail stroke-none" />
    </>
  ),
  // An open, empty box.
  archive: (
    <>
      <path d="M36 34h56v36H36z" />
      <path d="M36 34l10-14h36l10 14" />
      <path d="M54 46h20" />
    </>
  ),
};

/** A small line drawing, a title and a line or two of help. */
export function EmptyState({ art, title, children }: { art: keyof typeof ART; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <svg
        viewBox="0 0 128 80"
        className="h-20 w-32 opacity-70"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ART[art]}
      </svg>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children && <div className="text-sm opacity-70">{children}</div>}
    </div>
  );
}
