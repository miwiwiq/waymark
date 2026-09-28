import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches, registerDecorator } from 'class-validator';
import { QueryFailedError } from 'typeorm';

/** 3–30 characters of a–z, 0–9, '_' and '.', not starting or ending with '.'. */
export const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9._]{1,28}[a-z0-9_]$/;

/** Lowercases the input, then checks USERNAME_PATTERN. */
export function IsUsername(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    Matches(USERNAME_PATTERN, {
      message:
        'username must be 3–30 characters: letters, digits, "_" or "." (not first or last)',
    }),
  );
}

/** A real calendar date in YYYY-MM-DD format (rejects 2026-02-30). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** A calendar date between 1900-01-01 and today. */
export function isBirthDate(value: unknown): value is string {
  return (
    isCalendarDate(value) &&
    value >= '1900-01-01' &&
    new Date(`${value}T00:00:00Z`).getTime() <= Date.now()
  );
}

function dateDecorator(
  name: string,
  validate: (value: unknown) => boolean,
  message: string,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: { message },
      validator: { validate },
    });
  };
}

export function IsBirthDate(): PropertyDecorator {
  return dateDecorator(
    'isBirthDate',
    isBirthDate,
    'dateOfBirth must be a past date in YYYY-MM-DD format',
  );
}

export function IsCalendarDate(): PropertyDecorator {
  return dateDecorator(
    'isCalendarDate',
    isCalendarDate,
    '$property must be a date in YYYY-MM-DD format',
  );
}

/** True for Postgres unique violations, optionally on one named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string; constraint?: string };
  return (
    driverError.code === '23505' &&
    (constraint === undefined || driverError.constraint === constraint)
  );
}
