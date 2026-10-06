import { z } from "zod";

/** Same rule as the API: 3–30 characters of a–z, 0–9, "_" and ".", no "." first or last. */
export const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9._]{1,28}[a-z0-9_]$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    "3–30 characters: letters, digits, “_” or “.” (not first or last)",
  );

/** A date from a DateInput: "YYYY-MM-DD" when complete, the typed text otherwise. */
export function dateSchema(emptyMessage: string) {
  return z
    .string()
    .min(1, emptyMessage)
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a real date in full, as DD.MM.YYYY");
}

export const birthDateSchema = dateSchema("Enter your date of birth")
  .refine(
    (value) => value >= "1900-01-01" && new Date(value) <= new Date(),
    "Enter a date in the past",
  );

/** Today's date as YYYY-MM-DD: the latest date a date-of-birth picker allows. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
