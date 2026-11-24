import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found." });
}

// One place that turns every error into a clean JSON response.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join(" ");
    return res.status(400).json({ error: message });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.extra ?? {}) });
  }

  // The database refused a duplicate (two identical requests arriving together, for example).
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
    if (target.includes("dedupeKey") && target.includes("eventId")) {
      return res.status(409).json({ error: "This person is already pre-registered for this event." });
    }
    if (target.includes("dedupeKey")) {
      return res.status(409).json({ error: "A donor with the same name and birth date already exists." });
    }
    if (target.includes("donorId") && target.includes("eventId")) {
      return res.status(409).json({ error: "This donor already has a donation record for this event." });
    }
    if (target.includes("preRegId")) {
      return res.status(409).json({ error: "This pre-registration already has a donation record." });
    }
    return res.status(409).json({ error: "That username or email is already in use." });
  }

  // Malformed JSON body
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}
