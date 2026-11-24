import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errors";

// Sensitive donor details (full contact number, email, birth date, street address)
// are only sent after the signed-in person types their password again.
// A correct password earns a short-lived "reveal token" that must be sent in the
// X-Reveal-Token header together with the normal login token.
export const REVEAL_SECONDS = 5 * 60;

export function signRevealToken(userId: string): string {
  return jwt.sign({ purpose: "reveal" }, env.jwtSecret, { subject: userId, expiresIn: REVEAL_SECONDS });
}

export function requireReveal(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers["x-reveal-token"];
  if (typeof token !== "string" || !token) {
    return next(new AppError(403, "Confirm your password to view this information.", { code: "REAUTH_REQUIRED" }));
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (payload.purpose !== "reveal" || payload.sub !== req.user?.id) throw new Error("wrong token");
  } catch {
    return next(new AppError(403, "Your password confirmation has expired. Enter your password again.", { code: "REAUTH_REQUIRED" }));
  }
  next();
}

// True when the request carries a valid reveal token (used where the token is optional).
export function hasValidReveal(req: Request): boolean {
  const token = req.headers["x-reveal-token"];
  if (typeof token !== "string" || !token) return false;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    return payload.purpose === "reveal" && payload.sub === req.user?.id;
  } catch {
    return false;
  }
}
