import { z } from "zod";

// Field rules shared by the Users endpoints and the "edit my profile" endpoint.
export const nameSchema = z.string().trim().min(1, "Name is required.").max(100, "Name is too long.");

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be 30 characters or fewer.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only use letters, numbers, dots, dashes and underscores.")
  .transform((s) => s.toLowerCase());

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((s) => s.toLowerCase());

// Password rules (shown to the user while creating an account):
//   at least 8 characters, one uppercase, one lowercase, one number, one special character.
// bcrypt only uses the first 72 bytes of a password, so longer is pointless.
export const PASSWORD_RULES_TEXT =
  "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[A-Z]/, "Password needs at least one uppercase letter.")
  .regex(/[a-z]/, "Password needs at least one lowercase letter.")
  .regex(/[0-9]/, "Password needs at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password needs at least one special character (for example ! @ # $ %).");
