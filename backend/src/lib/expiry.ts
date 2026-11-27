import type { UnitStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { manilaToday } from "./today";
import { publishChange } from "../realtime";

// Units still in play that expire when their date passes. Not Usable and
// Expired units are already out of stock.
const EXPIRABLE: UnitStatus[] = ["PENDING_TESTING", "USABLE", "QUARANTINED"];

let running = false;
let lastRun = 0;

// Marks every unit past its expiration date as Expired and records it in the
// unit's history. A unit is still good on its expiration day itself.
// Safe to call often: it skips if it ran in the last 30 seconds, or is already running.
export async function sweepExpiredUnits(force = false): Promise<number> {
  if (running) return 0;
  if (!force && Date.now() - lastRun < 30_000) return 0;
  running = true;
  try {
    const today = manilaToday();
    const overdue = await prisma.bloodUnit.findMany({
      where: { expirationDate: { lt: today }, status: { in: EXPIRABLE } },
      select: { id: true },
    });
    lastRun = Date.now();
    if (overdue.length === 0) return 0;

    const ids = overdue.map((u) => u.id);
    await prisma.$transaction(async (tx) => {
      await tx.bloodUnit.updateMany({
        where: { id: { in: ids }, status: { in: EXPIRABLE } },
        data: { status: "EXPIRED" },
      });
      await tx.unitActivity.createMany({
        data: ids.map((unitId) => ({ unitId, action: "Expired", note: "Passed its expiration date" })),
      });
    });
    // Open screens (inventory, alerts) refresh themselves when units expire.
    publishChange(["blood-units", "inventory", "dashboard", "analytics", "notifications"]);
    return ids.length;
  } finally {
    running = false;
  }
}

// Runs once at startup and then every hour, so stock is correct even if
// nobody opens the page.
export function startExpirySweeper() {
  const run = () => sweepExpiredUnits(true).catch((err) => console.error("[kaDUGO] expiry sweep failed:", err));
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
