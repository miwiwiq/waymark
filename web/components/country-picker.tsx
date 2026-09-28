"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { COUNTRY_OPTIONS, countryFlag, countryName } from "@/lib/countries";
import { CONTROL } from "./ui";

/**
 * A searchable country list (P1). Type part of a name or a code; pick with the
 * mouse, or with the arrow keys and Enter. Drawn in the app's own colours, as
 * native dropdowns ignore the dark theme on some platforms.
 */
export function CountryPicker({
  value,
  onChange,
  onBlur,
  invalid,
}: {
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // Names that start with the query come first, then names that contain it, then an exact code ("GB").
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    const rank = ({ code, name }: (typeof COUNTRY_OPTIONS)[number]) =>
      name.toLowerCase().startsWith(q) ? 0 : name.toLowerCase().includes(q) ? 1 : code.toLowerCase() === q ? 2 : 3;
    return COUNTRY_OPTIONS.filter((option) => rank(option) < 3).sort((a, b) => rank(a) - rank(b));
  }, [query]);

  // Keep the highlighted country in view while moving with the keys.
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    if (open) return;
    setOpen(true);
    // Start at the current choice, so it's visible and Enter keeps it.
    setActive(Math.max(0, COUNTRY_OPTIONS.findIndex((option) => option.code === value)));
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(code: string) {
    onChange(code);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), matches.length - 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[active]) choose(matches[active].code);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  const selected = value ? `${countryFlag(value)} ${countryName(value)}` : "";

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].code}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        value={open ? query : selected}
        placeholder={open ? selected || "Search countries" : "Choose a country"}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        className={`${CONTROL} w-full pr-8`}
      />
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 opacity-60"
        fill="currentColor"
        aria-hidden
      >
        <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06z" />
      </svg>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          // Keep focus in the input (also when dragging the scrollbar), and stop the
          // surrounding <label> from turning a click on an option into a click on the input.
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.preventDefault()}
          className="absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border border-neutral-200 bg-background py-1 text-sm shadow-lg dark:border-neutral-700"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 opacity-60">No country matches “{query.trim()}”</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.code}
                id={`${listId}-${option.code}`}
                role="option"
                aria-selected={option.code === value}
                data-active={index === active}
                onClick={() => choose(option.code)}
                onMouseMove={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 ${index === active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
              >
                <span aria-hidden className="w-5 text-center text-base">
                  {countryFlag(option.code)}
                </span>
                <span className="flex-1">{option.name}</span>
                {option.code === value && (
                  <span aria-hidden className="text-trail">
                    ✓
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
