import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";

// Requires a valid "Authorization: Bearer <token>" header.
// The account is re-read from the database on every request, so a
// deactivated user, or one whose role was changed, loses access immediately
// instead of keeping it until the token expires. The role used for permission
// checks always comes from the database, never from the token.
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Authentication required.");
  }

  let userId: string | undefined;
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
    userId = payload.sub;
  } catch {
    throw new AppError(401, "Your session has expired. Please sign in again.");
  }
  if (!userId) throw new AppError(401, "Your session has expired. Please sign in again.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, email: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "This account is no longer active.");
  }

  req.user = user;
  next();
});

// Allows only the listed roles. Use after `authenticate`.
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Authentication required."));
    if (!allowed.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission to do that."));
    }
    next();
  };
}
