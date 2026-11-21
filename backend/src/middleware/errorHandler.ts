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
    return res.status(err.status).json({ error: err.message });
  }

  // Two requests created the same username/email at the same moment.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return res.status(409).json({ error: "That username or email is already in use." });
  }

  // Malformed JSON body
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}
