import { prisma } from "./prisma";
import { fromDbDate } from "./dates";
import { manilaToday } from "./today";
import { countsFor } from "../controllers/events.controller";
import { getInventorySummary } from "./inventory";

export const RANGES = ["last-3-months", "last-6-months", "this-year"] as const;
export type Range = (typeof RANGES)[number];

const RANGE_LABEL: Record<Range, string> = {
  "last-3-months": "Last 3 Months",
  "last-6-months": "Last 6 Months",
  "this-year": "This Year",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

// Moves a date by whole months, keeping the day of the month where it exists
// (31 Mar - 1 month = 28/29 Feb).
function shiftMonths(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const day = Math.min(date.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

const percentChange = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

async function completedDonationsBetween(from: Date, to: Date): Promise<number> {
  return prisma.donation.count({ where: { status: "COMPLETED", date: { gte: from, lte: to } } });
}

// Everything the Analytics page and Dashboard need, counted live from the
// records. Time-based figures (trends, testing outcomes, events) follow the
// chosen range. Stock figures (unit status, inventory) are always "right now".
export async function getOverview(range: Range) {
  const today = manilaToday();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  // ── the period ──
  const monthCount = range === "this-year" ? m + 1 : range === "last-3-months" ? 3 : 6;
  const start = new Date(Date.UTC(y, m - (monthCount - 1), 1));
  // The previous period is the same stretch of time shifted back, so a
  // half-finished current month is compared with a half-finished earlier one.
  const shiftBy = range === "this-year" ? -12 : -monthCount;
  const prevStart = shiftMonths(start, shiftBy);
  const prevEnd = shiftMonths(today, shiftBy);

  // ── monthly trend, with empty months shown as zero ──
  const buckets = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (monthCount - 1) + i, 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      month: MONTH_NAMES[d.getUTCMonth()],
      year: d.getUTCFullYear(),
      donations: 0,
      units: 0,
    };
  });
  const bucketOf = new Map(buckets.map((b) => [b.key, b]));
  const keyOf = (d: Date) => fromDbDate(d).slice(0, 7);

  const [donationRows, unitRows, previousDonations] = await Promise.all([
    prisma.donation.findMany({ where: { status: "COMPLETED", date: { gte: start, lte: today } }, select: { date: true } }),
    prisma.bloodUnit.findMany({ where: { collectionDate: { gte: start, lte: today } }, select: { collectionDate: true } }),
    completedDonationsBetween(prevStart, prevEnd),
  ]);
  for (const d of donationRows) {
    const b = bucketOf.get(keyOf(d.date));
    if (b) b.donations++;
  }
  for (const u of unitRows) {
    const b = bucketOf.get(keyOf(u.collectionDate));
    if (b) b.units++;
  }
  const currentDonations = donationRows.length;

  // ── this month so far, against the same days last month ──
  const monthStart = new Date(Date.UTC(y, m, 1));
  const prevMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const prevMonthSameDay = shiftMonths(today, -1);

  const [
    totalDonors, donationsThisMonth, donationsLastMonthSoFar, upcomingCount, nextEvent, expiredThisMonth,
    unitStatusRows, outcomeRows, eventsInPeriod, inventory,
  ] = await Promise.all([
    prisma.donor.count(),
    completedDonationsBetween(monthStart, today),
    completedDonationsBetween(prevMonthStart, prevMonthSameDay),
    prisma.donationEvent.count({ where: { status: "UPCOMING" } }),
    prisma.donationEvent.findFirst({ where: { status: "UPCOMING", date: { gte: today } }, orderBy: { date: "asc" } }),
    prisma.bloodUnit.count({ where: { status: "EXPIRED", expirationDate: { gte: monthStart, lte: today } } }),
    prisma.bloodUnit.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.bloodUnit.groupBy({ by: ["testingStatus"], where: { collectionDate: { gte: start, lte: today } }, _count: { _all: true } }),
    prisma.donationEvent.findMany({ where: { date: { gte: start, lte: today } }, orderBy: { date: "desc" }, take: 6 }),
    getInventorySummary(),
  ]);

  // ── stock by status (right now) ──
  const statusCount = (s: string) => unitStatusRows.find((r) => r.status === s)?._count._all ?? 0;
  const unitStatus = [
    { name: "Usable", value: statusCount("USABLE") },
    { name: "Quarantined", value: statusCount("QUARANTINED") },
    { name: "Not Usable", value: statusCount("NOT_USABLE") },
    { name: "Pending Testing", value: statusCount("PENDING_TESTING") },
    { name: "Expired", value: statusCount("EXPIRED") },
    { name: "Issued", value: statusCount("ISSUED") },
  ];
  const totalUnits = unitStatus.reduce((s, r) => s + r.value, 0);
  const usabilityRates = unitStatus.map((r) => ({
    name: r.name,
    value: r.value,
    percent: totalUnits > 0 ? Math.round((r.value / totalUnits) * 1000) / 10 : 0,
  }));

  // ── testing outcomes of units collected in the period ──
  const outcomeCount = (...keys: string[]) =>
    outcomeRows.filter((r) => keys.includes(r.testingStatus)).reduce((s, r) => s + r._count._all, 0);
  const testingOutcomes = [
    { name: "Non-Reactive", value: outcomeCount("PASSED", "COMPLETED") },
    { name: "Reactive", value: outcomeCount("REACTIVE") },
    { name: "For Confirmation", value: outcomeCount("FOR_CONFIRMATION") },
    { name: "Pending", value: outcomeCount("PENDING") },
  ];

  // ── event performance ──
  const eventCounts = await countsFor(eventsInPeriod.map((e) => e.id));
  const eventPerformance = eventsInPeriod.map((e) => {
    const c = eventCounts.get(e.id)!;
    return {
      id: e.id,
      name: e.name,
      date: fromDbDate(e.date),
      preRegistered: c.preRegistered,
      arrived: c.arrived,
      donations: c.donations,
      bloodUnits: c.bloodUnits,
    };
  });

  return {
    period: { range, label: RANGE_LABEL[range], from: fromDbDate(start), to: fromDbDate(today) },
    kpis: {
      totalDonors,
      donationsThisMonth,
      donationsLastMonthSameDays: donationsLastMonthSoFar,
      donationsChangePercent: percentChange(donationsThisMonth, donationsLastMonthSoFar),
      usableUnits: inventory.totals.usable,
      expiringSoonUnits: inventory.totals.expiringSoon,
      quarantinedUnits: inventory.totals.quarantined,
      notUsableUnits: inventory.totals.notUsable,
      pendingTestingUnits: inventory.totals.pendingTesting,
      expiredUnitsThisMonth: expiredThisMonth,
      upcomingEvents: upcomingCount,
      nextEventDate: nextEvent ? fromDbDate(nextEvent.date) : null,
    },
    donationTrends: buckets,
    trend: {
      current: currentDonations,
      previous: previousDonations,
      changePercent: percentChange(currentDonations, previousDonations),
      comparedWith: range === "this-year" ? "the same period last year" : `the previous ${monthCount} months`,
    },
    unitStatus,
    usabilityRates,
    testingOutcomes,
    inventoryByBloodType: inventory.byBloodType.map((b) => ({ type: b.bloodType, units: b.usable })),
    eventPerformance,
  };
}
