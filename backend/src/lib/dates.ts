import { z } from "zod";

// Calendar dates travel as "YYYY-MM-DD" text and are stored in PostgreSQL as
// DATE columns (no time zone, so a date never shifts by a day).

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
  .refine((s) => {
    // "2026-13-40" matches the pattern but is not a real date; an invalid Date
    // would throw on toISOString(), so check it first.
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Enter a valid date.");

// 24-hour clock time such as "08:00"
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour time format HH:MM.");

export const toDbDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);
