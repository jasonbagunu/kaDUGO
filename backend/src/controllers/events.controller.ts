import { z } from "zod";
import type { DonationEvent, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { dateString, fromDbDate, timeString, toDbDate } from "../lib/dates";
import { EVENT_STATUS_LABEL, eventStatusInput } from "../lib/labels";
import { eventContactNumber, optionalEmail, optionalUrl } from "../lib/validators";

// ───────────── validation ─────────────

// Fields are defined WITHOUT .default(): zod 3 and zod 4 treat defaults
// differently (zod 4 skips the label -> enum conversion, and applies defaults
// again inside .partial()). Defaults are applied explicitly in the handlers.
const eventFields = {
  name: z.string().trim().min(1, "Event name is required.").max(200, "Event name is too long."),
  date: dateString.refine((v) => {
    const year = Number(v.slice(0, 4));
    return year >= 2020 && year <= 2100;
  }, "Enter a realistic event date (between 2020 and 2100)."),
  startTime: timeString,
  endTime: timeString,
  location: z.string().trim().min(1, "Location is required.").max(200, "Location is too long."),
  description: z.string().trim().max(2000, "Description is too long."),
  organizer: z.string().trim().min(1, "Organizer is required.").max(200, "Organizer is too long."),
  // Digits only: an 11-digit mobile number starting with 09, or a landline with area code.
  contact: eventContactNumber,
  // Optional ways for donors to reach the organizers
  facebookUrl: optionalUrl,
  messengerUrl: optionalUrl,
  contactEmail: optionalEmail,
  otherPlatforms: z.string().trim().max(300, "Other contact details are too long (300 characters at most)."),
  status: eventStatusInput,
  registrationOpen: z.boolean(),
};

// Creating: description, status and registrationOpen are optional.
const createSchema = z
  .object({
    ...eventFields,
    description: eventFields.description.optional(),
    facebookUrl: eventFields.facebookUrl.optional(),
    messengerUrl: eventFields.messengerUrl.optional(),
    contactEmail: eventFields.contactEmail.optional(),
    otherPlatforms: eventFields.otherPlatforms.optional(),
    status: eventFields.status.optional(),
    registrationOpen: eventFields.registrationOpen.optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

// Updating: send only what changes; anything missing is left as it is.
const updateSchema = z.object(eventFields).partial();

const listQuerySchema = z.object({
  status: eventStatusInput.optional(),
  search: z.string().trim().optional(),
  // Pages are optional: dropdowns elsewhere ask for the whole list.
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(500),
});

// ───────────── calculated numbers ─────────────

interface EventCounts {
  preRegistered: number;
  arrived: number;
  eligibleDonors: number;
  donations: number;
  bloodUnits: number;
}

// These numbers are never stored; they are counted from the related rows so
// they can never disagree with the real records.
//   preRegistered  = everyone who signed up
//   arrived        = marked as arrived on the day
//   eligibleDonors = arrived, minus those deferred at screening
//   donations      = donation records linked to the event
//   bloodUnits     = blood units created from those donations
export async function countsFor(eventIds: string[]): Promise<Map<string, EventCounts>> {
  const result = new Map<string, EventCounts>();
  for (const id of eventIds) {
    result.set(id, { preRegistered: 0, arrived: 0, eligibleDonors: 0, donations: 0, bloodUnits: 0 });
  }
  if (eventIds.length === 0) return result;

  const [signups, donations, units] = await Promise.all([
    prisma.preRegistration.groupBy({
      by: ["eventId", "attendance", "outcome"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
    prisma.donation.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
    prisma.donation.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, bloodUnit: { isNot: null } },
      _count: { _all: true },
    }),
  ]);

  for (const row of signups) {
    const c = result.get(row.eventId);
    if (!c) continue;
    const n = row._count._all;
    c.preRegistered += n;
    if (row.attendance === "ARRIVED") {
      c.arrived += n;
      if (row.outcome !== "DEFERRED") c.eligibleDonors += n;
    }
  }
  for (const row of donations) {
    if (row.eventId && result.has(row.eventId)) result.get(row.eventId)!.donations = row._count._all;
  }
  for (const row of units) {
    if (row.eventId && result.has(row.eventId)) result.get(row.eventId)!.bloodUnits = row._count._all;
  }
  return result;
}

function serializeEvent(e: DonationEvent, counts: EventCounts) {
  return {
    id: e.id,
    name: e.name,
    date: fromDbDate(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
    location: e.location,
    description: e.description,
    organizer: e.organizer,
    contact: e.contact,
    facebookUrl: e.facebookUrl,
    messengerUrl: e.messengerUrl,
    contactEmail: e.contactEmail,
    otherPlatforms: e.otherPlatforms,
    status: EVENT_STATUS_LABEL[e.status],
    registrationOpen: e.registrationOpen,
    // Used to build the public registration link: /register/<publicToken>
    publicToken: e.publicToken,
    createdAt: e.createdAt,
    ...counts,
  };
}

// ───────────── handlers (all three roles) ─────────────

export const listEvents = asyncHandler(async (req, res) => {
  const { status, search, page, pageSize } = listQuerySchema.parse(req.query);

  const where: Prisma.DonationEventWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [events, total, byStatus] = await Promise.all([
    prisma.donationEvent.findMany({ where, orderBy: { date: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.donationEvent.count({ where }),
    prisma.donationEvent.groupBy({ by: ["status"], _count: { _all: true } }), // whole list, for the summary tiles
  ]);
  const counts = await countsFor(events.map((e) => e.id));
  const statusCounts: Record<string, number> = { Upcoming: 0, Ongoing: 0, Completed: 0, Cancelled: 0 };
  for (const row of byStatus) statusCounts[EVENT_STATUS_LABEL[row.status]] = row._count._all;
  res.json({ events: events.map((e) => serializeEvent(e, counts.get(e.id)!)), total, page, pageSize, statusCounts });
});

export const getEvent = asyncHandler(async (req, res) => {
  const event = await prisma.donationEvent.findUnique({ where: { id: String(req.params.id) } });
  if (!event) throw new AppError(404, "Event not found.");
  const counts = await countsFor([event.id]);
  res.json({ event: serializeEvent(event, counts.get(event.id)!) });
});

export const createEvent = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = createSchema.parse(req.body);
  const year = Number(data.date.slice(0, 4));

  const event = await prisma.$transaction(async (tx) => {
    // EVT-2026-001: the running number restarts each year.
    const id = await nextId(tx, `event-${year}`, `EVT-${year}-`, 3);
    const created = await tx.donationEvent.create({
      data: {
        id,
        name: data.name,
        date: toDbDate(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        description: data.description ?? "",
        organizer: data.organizer,
        contact: data.contact,
        facebookUrl: data.facebookUrl ?? "",
        messengerUrl: data.messengerUrl ?? "",
        contactEmail: data.contactEmail ?? "",
        otherPlatforms: data.otherPlatforms ?? "",
        status: data.status ?? "UPCOMING",
        registrationOpen: data.registrationOpen ?? true,
        createdById: actor.id,
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Event Created",
      details: `Created donation event "${data.name}" (${id})`,
      ipAddress: req.ip,
    });
    return created;
  });

  res.status(201).json({ event: serializeEvent(event, { preRegistered: 0, arrived: 0, eligibleDonors: 0, donations: 0, bloodUnits: 0 }) });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateSchema.parse(req.body);
  const existing = await prisma.donationEvent.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, "Event not found.");

  // The time check needs the final values, so mix new and existing ones.
  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (endTime <= startTime) throw new AppError(400, "endTime: End time must be after start time.");

  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.donationEvent.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        date: data.date ? toDbDate(data.date) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        description: data.description,
        organizer: data.organizer,
        contact: data.contact,
        facebookUrl: data.facebookUrl,
        messengerUrl: data.messengerUrl,
        contactEmail: data.contactEmail,
        otherPlatforms: data.otherPlatforms,
        status: data.status,
        registrationOpen: data.registrationOpen,
      },
    });
    const changed = Object.keys(data).join(", ") || "no fields";
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Event Updated",
      details: `Updated "${updated.name}" (${updated.id}): ${changed}`,
      ipAddress: req.ip,
    });
    return updated;
  });

  const counts = await countsFor([event.id]);
  res.json({ event: serializeEvent(event, counts.get(event.id)!) });
});
