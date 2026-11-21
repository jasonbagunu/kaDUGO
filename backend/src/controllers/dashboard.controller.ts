import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../lib/prisma";
import { fromDbDate } from "../lib/dates";
import { manilaToday } from "../lib/today";
import { getOverview } from "../lib/analytics";
import { getInventorySummary } from "../lib/inventory";

// The landing page for every role, but each role only receives what it is
// allowed to see. Super Admin is system administration, not blood-bank staff,
// so they get system figures and upcoming events, and no donor or blood data.
export const dashboard = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const today = manilaToday();

  const [upcomingCount, nextEvent] = await Promise.all([
    prisma.donationEvent.count({ where: { status: "UPCOMING" } }),
    prisma.donationEvent.findFirst({ where: { status: "UPCOMING", date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);
  const upcomingEvents = { count: upcomingCount, nextDate: nextEvent ? fromDbDate(nextEvent.date) : null };

  if (actor.role === "SUPER_ADMIN") {
    const [byRole, byStatus] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const roleCount = (r: string) => byRole.find((x) => x.role === r)?._count._all ?? 0;
    const statusCount = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
    return res.json({
      role: actor.role,
      upcomingEvents,
      system: {
        totalUsers: statusCount("ACTIVE") + statusCount("INACTIVE"),
        activeUsers: statusCount("ACTIVE"),
        inactiveUsers: statusCount("INACTIVE"),
        admins: roleCount("ADMIN"),
        medTechs: roleCount("MEDTECH"),
      },
    });
  }

  // Admin and MedTech
  const overview = await getOverview("last-6-months");
  const inventory = await getInventorySummary();
  res.json({
    role: actor.role,
    upcomingEvents,
    kpis: overview.kpis,
    inventory,
    donationTrends: overview.donationTrends,
    unitStatus: overview.unitStatus,
  });
});
