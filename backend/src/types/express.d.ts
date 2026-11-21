import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      // Set by the authenticate middleware on protected routes.
      user?: {
        id: string;
        name: string;
        username: string;
        email: string;
        role: Role;
        status: string;
      };
    }
  }
}

export {};
