import { z } from "zod";
import { dateString, toDbDate } from "./dates";

// Treat "" and null as "not provided" (empty form fields arrive as "").
export const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const contactNumber = z
  .string()
  .trim()
  .min(7, "Enter a valid contact number.")
  .max(20, "Enter a valid contact number.")
  .regex(/^[0-9+()\-\s]+$/, "Enter a valid contact number.");

// Email is optional: an empty string is fine, anything else must look like an email.
export const optionalEmail = z
  .string()
  .trim()
  .max(150, "Email is too long.")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address.");

// A calendar date that is not in the future. Dates carry no time zone, and the
// server clock runs on UTC, which is 8 hours behind the Philippines: between
// midnight and 8 AM local time, "today" for staff is already "tomorrow" in UTC.
// One day of slack keeps those early-morning entries from being rejected.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const pastDate = (message: string) =>
  dateString.refine((s) => toDbDate(s).getTime() <= Date.now() + ONE_DAY_MS, message);
