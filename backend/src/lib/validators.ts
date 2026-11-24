import { z } from "zod";
import { dateString, toDbDate } from "./dates";

// Treat "" and null as "not provided" (empty form fields arrive as "").
export const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

// Philippine mobile number: exactly 11 digits starting with 09 (e.g. 09171234567).
// Spaces and dashes typed by the user are removed before checking.
export const phMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^09\d{9}$/.test(v), "Enter an 11-digit mobile number that starts with 09 (e.g. 09171234567).");

// Contact number for an event: digits only. A mobile number must be the usual 11
// digits starting with 09; anything else is treated as a landline with area code (7-11 digits).
export const eventContactNumber = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^\d{7,11}$/.test(v), "Contact number must contain digits only (7 to 11 digits).")
  .refine((v) => !v.startsWith("09") || v.length === 11, "A mobile number must be 11 digits and start with 09.");

// Only http(s) links are accepted for social media / announcement links.
export const optionalUrl = z
  .string()
  .trim()
  .max(300, "Link is too long.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full link that starts with http:// or https://.");

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
