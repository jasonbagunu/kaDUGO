import type { Prisma, PrismaClient, Role } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  userId?: string | null;
  userName: string;
  userRole?: Role | null;
  action: string;
  details?: string;
  ipAddress?: string;
}

// Writes one row to the audit trail. Pass the transaction client when the
// action itself runs in a transaction, so the log and the change are saved
// together or not at all. Never put passwords or tokens in `details`.
export async function logAudit(client: Client, entry: AuditEntry) {
  await client.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      userName: entry.userName,
      userRole: entry.userRole ?? null,
      action: entry.action,
      details: entry.details ?? "",
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
