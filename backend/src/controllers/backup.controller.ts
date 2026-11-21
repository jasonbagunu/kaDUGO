import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { logAudit } from "../lib/audit";
import { manilaTodayString } from "../lib/today";

// A full copy of the database as one JSON file (Super Admin only).
// WARNING: it contains personal and medical records and password hashes, so
// the file must be stored and shared like any confidential record.
export const exportBackup = asyncHandler(async (req, res) => {
  const actor = req.user!;

  // RepeatableRead = every table is read from the same moment in time, so the
  // copy is consistent even if someone saves a record while it is running.
  const data = await prisma.$transaction(
    async (tx) => ({
      users: await tx.user.findMany({ orderBy: { id: "asc" } }),
      donationEvents: await tx.donationEvent.findMany({ orderBy: { id: "asc" } }),
      preRegistrations: await tx.preRegistration.findMany({ orderBy: { id: "asc" } }),
      donors: await tx.donor.findMany({ orderBy: { id: "asc" } }),
      donations: await tx.donation.findMany({ orderBy: { id: "asc" } }),
      bloodUnits: await tx.bloodUnit.findMany({ orderBy: { id: "asc" } }),
      testRecords: await tx.testRecord.findMany({ orderBy: { id: "asc" } }),
      testResults: await tx.testResult.findMany({ orderBy: { id: "asc" } }),
      unitActivities: await tx.unitActivity.findMany({ orderBy: { id: "asc" } }),
      auditLogs: await tx.auditLog.findMany({ orderBy: { id: "asc" } }),
      counters: await tx.counter.findMany({ orderBy: { name: "asc" } }),
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
  );

  const counts = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length]));

  // Only table names and row counts go in the audit trail, never the records.
  await logAudit(prisma, {
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    action: "Backup Exported",
    details: `Exported a full backup (${Object.values(counts).reduce((a, b) => a + b, 0)} rows)`,
    ipAddress: req.ip,
  });

  res.setHeader("Content-Disposition", `attachment; filename="kaDUGO-backup-${manilaTodayString()}.json"`);
  res.json({ system: "kaDUGO", format: 1, exportedAt: new Date().toISOString(), counts, data });
});
