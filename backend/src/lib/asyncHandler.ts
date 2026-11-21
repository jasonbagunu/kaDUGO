import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch errors thrown inside async handlers on its own.
// This wrapper sends them to the central error handler instead.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
