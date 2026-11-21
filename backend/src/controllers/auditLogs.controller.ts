import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";

const querySchema = z.object({
  search: z.string().trim().optional(),
  action: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { search, action, page, pageSize } = querySchema.parse(req.query);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { userName: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { details: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, actionRows] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    code: `LOG-${String(r.id).padStart(4, "0")}`,
    timestamp: r.createdAt,
    userName: r.userName,
    userRole: r.userRole,
    action: r.action,
    details: r.details,
    ipAddress: r.ipAddress,
  }));

  res.json({ items, total, page, pageSize, actions: actionRows.map((a) => a.action).sort() });
});
