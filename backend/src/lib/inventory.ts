import type { BloodType } from "@prisma/client";
import { prisma } from "./prisma";
import { sweepExpiredUnits } from "./expiry";
import { manilaToday, manilaTodayString } from "./today";
import { addDays } from "./shelfLife";
import { BLOOD_TYPE_LABEL, COMPONENT_LABEL } from "./labels";

export const BLOOD_TYPE_ORDER: BloodType[] = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"];

// A blood type is "low stock" when its usable units fall below this number.
export const LOW_STOCK_THRESHOLD: Record<BloodType, number> = {
  A_POS: 20, A_NEG: 5, B_POS: 20, B_NEG: 5, AB_POS: 10, AB_NEG: 3, O_POS: 30, O_NEG: 8,
};

// "Expiring soon" = usable units that expire within this many days (today included).
export const EXPIRING_SOON_DAYS = 7;

export interface StatusCounts {
  usable: number;
  quarantined: number;
  notUsable: number;
  pendingTesting: number;
  expired: number;
  issued: number;
  expiringSoon: number;
}

const emptyCounts = (): StatusCounts => ({ usable: 0, quarantined: 0, notUsable: 0, pendingTesting: 0, expired: 0, issued: 0, expiringSoon: 0 });

// Current stock, counted live from the blood units: nothing here is stored.
export async function getInventorySummary() {
  await sweepExpiredUnits(); // expired units must not be counted as stock
  const today = manilaToday();

  const [statusRows, expiringRows, componentRows] = await Promise.all([
    prisma.bloodUnit.groupBy({ by: ["bloodType", "status"], _count: { _all: true } }),
    prisma.bloodUnit.groupBy({
      by: ["bloodType"],
      where: { status: "USABLE", expirationDate: { gte: today, lte: addDays(today, EXPIRING_SOON_DAYS) } },
      _count: { _all: true },
    }),
    prisma.bloodUnit.groupBy({ by: ["component"], where: { status: "USABLE" }, _count: { _all: true } }),
  ]);

  const perType = new Map<BloodType, StatusCounts>(BLOOD_TYPE_ORDER.map((bt) => [bt, emptyCounts()]));
  for (const row of statusRows) {
    const c = perType.get(row.bloodType)!;
    const n = row._count._all;
    if (row.status === "USABLE") c.usable += n;
    else if (row.status === "QUARANTINED") c.quarantined += n;
    else if (row.status === "NOT_USABLE") c.notUsable += n;
    else if (row.status === "PENDING_TESTING") c.pendingTesting += n;
    else if (row.status === "EXPIRED") c.expired += n;
    else if (row.status === "ISSUED") c.issued += n;
  }
  for (const row of expiringRows) perType.get(row.bloodType)!.expiringSoon = row._count._all;

  const totals = emptyCounts();
  const byBloodType = BLOOD_TYPE_ORDER.map((bt) => {
    const c = perType.get(bt)!;
    for (const k of Object.keys(totals) as (keyof StatusCounts)[]) totals[k] += c[k];
    return {
      bloodType: BLOOD_TYPE_LABEL[bt],
      ...c,
      lowStockThreshold: LOW_STOCK_THRESHOLD[bt],
      isLowStock: c.usable < LOW_STOCK_THRESHOLD[bt],
    };
  });

  return {
    asOf: manilaTodayString(),
    expiringSoonDays: EXPIRING_SOON_DAYS,
    byBloodType,
    totals,
    byComponent: componentRows.map((r) => ({ component: COMPONENT_LABEL[r.component], usable: r._count._all })),
  };
}
