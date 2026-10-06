"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import { CONTROL } from "./ui";

const PLACEHOLDER = "DD.MM.YYYY";
const LENGTHS = [2, 2, 4];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats typed text as DD.MM.YYYY: digits fill day, month and year in turn,
 * and the dots appear by themselves. Typing a separator after one digit pads
 * it ("1." → "01.").
 */
function mask(raw: string): string {
  const groups = [""];
  for (const char of raw) {
    const index = groups.length - 1;
    const full = groups[index].length === LENGTHS[index];
    if (/\d/.test(char)) {
      if (!full) groups[index] += char;
      else if (index < 2) groups.push(char);
    } else if (groups[index] && index < 2) {
      groups[index] = groups[index].padStart(2, "0");
      groups.push("");
    }
  }
  return groups.join(".");
}

/** "YYYY-MM-DD" when the text is a complete, real date; otherwise null. */
function parse(text: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" as DD.MM.YYYY; anything else (half-typed text) as is. */
function display(iso: string): string {
  const match = ISO.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

/**
 * A date you can type as DD.MM.YYYY or pick
 * from a calendar with month and year lists. Reports "YYYY-MM-DD" once the
 * date is complete and real, and the typed text otherwise, so the form's
 * schema can reject it.
 */
export function DateInput({
  value,
  onChange,
  onBlur,
  name,
  min = "1900-01-01",
  max,
  autoComplete = "off",
  align = "left",
  ref,
  "aria-invalid": invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  min?: string;
  max?: string;
  /** "bday" for a date of birth, so browsers can fill it in. */
  autoComplete?: string;
  /** Which edge of the field the calendar lines up with, so it stays on screen. */
  align?: "left" | "right";
  ref?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
}) {
  const [text, setText] = useState(() => display(value));
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const calendarId = useId();
  const formatHintId = useId();

  // Follow outside changes, such as a form reset.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    if (value !== (parse(text) ?? text)) setText(display(value));
  }

  function handleText(raw: string) {
    // A pasted ISO date ("1995-04-12") is taken as is.
    const next = ISO.test(raw.trim()) ? display(raw.trim()) : mask(raw);
    setText(next);
    onChange(parse(next) ?? next);
  }

  function pick(iso: string) {
    setText(display(iso));
    onChange(iso);
    setOpen(false);
    toggle.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <input
        ref={ref}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder={PLACEHOLDER}
        aria-invalid={invalid}
        aria-describedby={formatHintId}
        value={text}
        onChange={(event) => handleText(event.target.value)}
        onBlur={onBlur}
        className={`${CONTROL} w-full pr-11 tabular-nums`}
      />
      <span id={formatHintId} className="sr-only">
        Format {PLACEHOLDER}
      </span>
      <button
        ref={toggle}
        type="button"
        aria-label="Choose from calendar"
        aria-expanded={open}
        aria-controls={calendarId}
        onClick={() => setOpen((current) => !current)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 opacity-70 hover:bg-neutral-200/60 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-trail dark:hover:bg-neutral-800"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && (
        <Calendar
          id={calendarId}
          selected={parse(text)}
          align={align}
          min={min}
          max={max}
          onPick={pick}
        />
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** Monday or Sunday first, as the browser's locale prefers (Monday where it can't tell). */
function firstWeekday(): number {
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const info = locale.getWeekInfo?.() ?? locale.weekInfo;
  return (info?.firstDay ?? 1) % 7;
}

function Calendar({
  id,
  selected,
  align,
  min,
  max,
  onPick,
}: {
  id: string;
  selected: string | null;
  align: "left" | "right";
  min: string;
  max?: string;
  onPick: (iso: string) => void;
}) {
  const last = max ?? `${new Date().getFullYear() + 10}-12-31`;
  // Without a date yet, open on this month, or the nearest month allowed.
  const today = new Date().toISOString().slice(0, 10);
  const start = selected ?? (today < min ? min : today > last ? last : today);
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 });
  const yearSelect = useRef<HTMLSelectElement>(null);

  // Dates are often years back (a birth date, an old trip), so the year list gets focus first.
  useEffect(() => yearSelect.current?.focus(), []);

  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(last.slice(0, 4));
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const monthNames = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2000, m, 1)),
  );
  const firstDay = firstWeekday();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    // 2023-01-01 was a Sunday.
    new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(2023, 0, 1 + ((firstDay + i) % 7))),
  );
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const blanks = (new Date(view.year, view.month, 1).getDay() - firstDay + 7) % 7;
  const label = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

  function shift(step: number) {
    const date = new Date(view.year, view.month + step, 1);
    if (date.getFullYear() < minYear || date.getFullYear() > maxYear) return;
    setView({ year: date.getFullYear(), month: date.getMonth() });
  }

  const select = "rounded-md border border-neutral-300 bg-background px-2 py-1 dark:border-neutral-700";
  const arrow = "rounded-md p-1.5 hover:bg-neutral-200/60 disabled:opacity-30 dark:hover:bg-neutral-800";

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Choose a date"
      className={`absolute ${align === "right" ? "right-0" : "left-0"} z-30 mt-1 w-72 max-w-[calc(100vw_-_2rem)] rounded-xl border border-neutral-200 bg-background p-3 text-sm shadow-xl dark:border-neutral-700`}
    >
      <div className="mb-2 flex items-center gap-1">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className={arrow}>
          ‹
        </button>
        <select
          aria-label="Month"
          value={view.month}
          onChange={(event) => setView({ ...view, month: Number(event.target.value) })}
          className={`${select} min-w-0 flex-1`}
        >
          {monthNames.map((name, m) => (
            <option key={name} value={m}>
              {name}
            </option>
          ))}
        </select>
        <select
          ref={yearSelect}
          aria-label="Year"
          value={view.year}
          onChange={(event) => setView({ ...view, year: Number(event.target.value) })}
          className={select}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className={arrow}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((day, i) => (
          <span key={i} aria-hidden className="py-1 text-xs opacity-50">
            {day}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoOf(view.year, view.month, i + 1);
          const isSelected = iso === selected;
          const outOfRange = iso < min || (max !== undefined && iso > max);
          return (
            <button
              key={iso}
              type="button"
              disabled={outOfRange}
              aria-pressed={isSelected}
              aria-label={label.format(new Date(view.year, view.month, i + 1))}
              onClick={() => onPick(iso)}
              className={`rounded-md py-1.5 tabular-nums focus-visible:outline-2 focus-visible:outline-trail disabled:opacity-25 ${
                isSelected
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "enabled:hover:bg-neutral-200/60 dark:enabled:hover:bg-neutral-800"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
