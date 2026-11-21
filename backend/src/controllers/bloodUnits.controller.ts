import { z } from "zod";
import type { Prisma, TestingStatus, UnitStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { logAudit } from "../lib/audit";
import { fromDbDate, toDbDate } from "../lib/dates";
import { sweepExpiredUnits } from "../lib/expiry";
import { manilaToday, manilaTodayString } from "../lib/today";
import { REQUIRED_TESTS, REQUIRED_TEST_NAMES } from "../lib/screening";
import { addDays } from "../lib/shelfLife";
import { emptyToUndefined, pastDate } from "../lib/validators";
import {
  BLOOD_TYPE_LABEL, COMPONENT_LABEL, DONATION_STATUS_LABEL, TESTING_STATUS_LABEL, UNIT_STATUS_LABEL,
  bloodTypeInput, componentInput, testingStatusInput, unitStatusInput,
} from "../lib/labels";

// ───────────── validation (no .default(): see events.controller) ─────────────

const listQuerySchema = z.object({
  status: unitStatusInput.optional(),
  testingStatus: testingStatusInput.optional(),
  bloodType: bloodTypeInput.optional(),
  component: componentInput.optional(),
  search: z.string().trim().optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
  sort: z.enum(["expiry", "recent"], { message: "Sort must be expiry or recent." }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

const testSchema = z
  .object({
    testingDate: z.preprocess(emptyToUndefined, pastDate("Testing date cannot be in the future.").optional()),
    tests: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Test name is required."),
          result: z.enum(["Non-Reactive", "Reactive"], { message: "Each result must be Non-Reactive or Reactive." }),
        })
      )
      .length(REQUIRED_TESTS.length, `Record all ${REQUIRED_TESTS.length} required screening tests.`),
  })
  .refine(
    (d) => {
      const names = d.tests.map((t) => t.name);
      return new Set(names).size === names.length && REQUIRED_TEST_NAMES.every((n) => names.includes(n));
    },
    { message: `Record each required test exactly once: ${REQUIRED_TEST_NAMES.join("; ")}.`, path: ["tests"] }
  );

const statusSchema = z.object({
  status: unitStatusInput,
  reason: z.string().trim().min(3, "Give a reason for the change.").max(300, "Reason is too long."),
});

const storageSchema = z
  .object({
    storageLocation: z.string().trim().min(1, "Storage location cannot be empty.").max(100, "Storage location is too long.").optional(),
    shelf: z.string().trim().min(1, "Shelf cannot be empty.").max(50, "Shelf is too long.").optional(),
    position: z.string().trim().min(1, "Position cannot be empty.").max(50, "Position is too long.").optional(),
  })
  .refine((d) => d.storageLocation !== undefined || d.shelf !== undefined || d.position !== undefined, {
    message: "Send a storageLocation, shelf and/or position to update.",
  });

const issueSchema = z.object({
  issuedTo: z.string().trim().min(2, "Enter who the blood was issued to (hospital or office).").max(150, "Recipient is too long."),
  issuedDate: z.preprocess(emptyToUndefined, pastDate("Issue date cannot be in the future.").optional()),
  note: z.string().trim().max(300, "Note is too long.").optional(),
});

const activitySchema = z.object({
  action: z.enum(["Processed", "Disposed"], { message: "Action must be Processed or Disposed." }),
  note: z.string().trim().max(300, "Note is too long.").optional(),
});

// ───────────── what we send back ─────────────

const unitInclude = {
  donation: {
    select: {
      id: true,
      donorId: true,
      eventId: true,
      donor: { select: { name: true } },
      event: { select: { name: true } },
    },
  },
} satisfies Prisma.BloodUnitInclude;

type UnitWithDonation = Prisma.BloodUnitGetPayload<{ include: typeof unitInclude }>;

interface LastActivity {
  date: string | null;
  note: string;
  action: string;
}

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - manilaToday().getTime()) / 86_400_000);
}

function serializeUnit(u: UnitWithDonation, last: LastActivity | null) {
  return {
    id: u.id,
    donationId: u.donationId,
    donorId: u.donation.donorId,
    donorName: u.donation.donor.name,
    eventId: u.donation.eventId,
    eventName: u.donation.event?.name ?? null,
    bloodType: BLOOD_TYPE_LABEL[u.bloodType],
    component: COMPONENT_LABEL[u.component],
    collectionDate: fromDbDate(u.collectionDate),
    expirationDate: fromDbDate(u.expirationDate),
    daysToExpiry: daysUntil(u.expirationDate),
    status: UNIT_STATUS_LABEL[u.status],
    testingStatus: TESTING_STATUS_LABEL[u.testingStatus],
    storageLocation: u.storageLocation,
    shelf: u.shelf,
    position: u.position,
    lastActivity: last?.date ?? null,
    lastActivityNote: last?.note ?? "",
    lastActivityAction: last?.action ?? "",
  };
}

const testRecordInclude = {
  results: { orderBy: { id: "asc" } },
  testedBy: { select: { name: true } },
} satisfies Prisma.TestRecordInclude;

type TestRecordFull = Prisma.TestRecordGetPayload<{ include: typeof testRecordInclude }>;

export function serializeTestRecord(t: TestRecordFull) {
  return {
    id: t.id,
    unitId: t.unitId,
    testingDate: fromDbDate(t.testingDate),
    screeningStatus: TESTING_STATUS_LABEL[t.screeningStatus],
    result: t.result,
    usabilityStatus: UNIT_STATUS_LABEL[t.usabilityStatus],
    testedBy: t.testedBy?.name ?? null,
    tests: t.results.map((r) => ({ name: r.name, result: r.result, passed: r.passed })),
    createdAt: t.createdAt,
  };
}

async function loadUnit(id: string) {
  const unit = await prisma.bloodUnit.findUnique({ where: { id }, include: unitInclude });
  if (!unit) throw new AppError(404, "Blood unit not found.");
  return unit;
}

async function latestActivity(unitId: string): Promise<LastActivity | null> {
  const a = await prisma.unitActivity.findFirst({
    where: { unitId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  return a ? { date: fromDbDate(a.occurredAt), note: a.note || a.action, action: a.action } : null;
}

// ───────────── handlers (Admin and MedTech) ─────────────

export const listBloodUnits = asyncHandler(async (req, res) => {
  const q = listQuerySchema.parse(req.query);
  await sweepExpiredUnits(); // make sure expired units are marked before listing

  const today = manilaToday();
  // "Expiring soon" only makes sense for units still in play, unless the
  // caller asks for a specific status, which then wins.
  const inPlay: UnitStatus[] = ["PENDING_TESTING", "USABLE", "QUARANTINED"];
  const expiring = q.expiringWithinDays !== undefined;
  const where: Prisma.BloodUnitWhereInput = {
    ...(q.status ? { status: q.status } : expiring ? { status: { in: inPlay } } : {}),
    ...(q.testingStatus ? { testingStatus: q.testingStatus } : {}),
    ...(q.bloodType ? { bloodType: q.bloodType } : {}),
    ...(q.component ? { component: q.component } : {}),
    ...(expiring ? { expirationDate: { gte: today, lte: addDays(today, q.expiringWithinDays!) } } : {}),
    ...(q.search
      ? {
          OR: [
            { id: { contains: q.search, mode: "insensitive" } },
            { donationId: { contains: q.search, mode: "insensitive" } },
            { donation: { donor: { name: { contains: q.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [units, total] = await Promise.all([
    prisma.bloodUnit.findMany({
      where,
      include: unitInclude,
      // default: soonest to expire first; sort=recent: newest first
      orderBy: q.sort === "recent" ? [{ createdAt: "desc" }, { id: "desc" }] : { expirationDate: "asc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.bloodUnit.count({ where }),
  ]);

  // newest history entry of each listed unit
  const activities = units.length
    ? await prisma.unitActivity.findMany({
        where: { unitId: { in: units.map((u) => u.id) } },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        distinct: ["unitId"],
      })
    : [];
  const lastByUnit = new Map(
    activities.map((a) => [a.unitId, { date: fromDbDate(a.occurredAt), note: a.note || a.action, action: a.action }])
  );

  res.json({
    items: units.map((u) => serializeUnit(u, lastByUnit.get(u.id) ?? null)),
    total,
    page: q.page,
    pageSize: q.pageSize,
  });
});

// One unit with everything needed for traceability: donor, donation, event,
// every test, and the full history.
export const getBloodUnit = asyncHandler(async (req, res) => {
  await sweepExpiredUnits();
  const id = String(req.params.id);

  const unit = await prisma.bloodUnit.findUnique({
    where: { id },
    include: {
      ...unitInclude,
      donation: {
        select: {
          id: true, donorId: true, eventId: true, date: true, status: true, personnel: true, notes: true,
          donor: { select: { name: true } },
          event: { select: { name: true } },
        },
      },
      testRecords: { include: testRecordInclude, orderBy: [{ testingDate: "desc" }, { id: "desc" }] },
      activities: {
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        include: { performedBy: { select: { name: true } } },
      },
    },
  });
  if (!unit) throw new AppError(404, "Blood unit not found.");

  const newest = unit.activities[0];
  const last: LastActivity | null = newest
    ? { date: fromDbDate(newest.occurredAt), note: newest.note || newest.action, action: newest.action }
    : null;

  res.json({
    unit: serializeUnit(unit, last),
    donation: {
      id: unit.donation.id,
      date: fromDbDate(unit.donation.date),
      status: DONATION_STATUS_LABEL[unit.donation.status],
      personnel: unit.donation.personnel,
      notes: unit.donation.notes,
    },
    testRecords: unit.testRecords.map(serializeTestRecord),
    history: unit.activities.map((a) => ({
      id: a.id,
      action: a.action,
      note: a.note,
      occurredAt: a.occurredAt,
      performedBy: a.performedBy?.name ?? null,
    })),
  });
});

// Record screening results. The SYSTEM decides the outcome, so a unit can
// never be marked Usable by hand:
//   first screening   all non-reactive -> Passed / Usable
//                     any reactive     -> For Confirmation / Quarantined
//   confirmatory test all non-reactive -> Passed / Usable (cleared)
//                     any reactive     -> Reactive / Not Usable (confirmed)
export const recordTest = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = testSchema.parse(req.body);
  await sweepExpiredUnits();
  const unit = await loadUnit(String(req.params.id));

  const isScreening =
    unit.testingStatus === "PENDING" && (unit.status === "PENDING_TESTING" || unit.status === "QUARANTINED");
  const isConfirmation = unit.testingStatus === "FOR_CONFIRMATION" && unit.status === "QUARANTINED";
  if (!isScreening && !isConfirmation) {
    if (unit.status === "EXPIRED") throw new AppError(409, "This unit has expired and can no longer be tested.");
    if (unit.status === "NOT_USABLE") throw new AppError(409, "This unit is marked Not Usable and can no longer be tested.");
    if (unit.status === "ISSUED") throw new AppError(409, "This unit has been issued and can no longer be tested.");
    throw new AppError(409, "This unit has already completed testing.");
  }

  const reactive = data.tests.filter((t) => t.result === "Reactive");
  const anyReactive = reactive.length > 0;
  const shortNames = reactive
    .map((t) => REQUIRED_TESTS.find((r) => r.name === t.name)?.short ?? t.name)
    .join(", ");

  let screeningStatus: TestingStatus;
  let newStatus: UnitStatus;
  let action: string;
  if (isScreening) {
    screeningStatus = anyReactive ? "FOR_CONFIRMATION" : "PASSED";
    newStatus = anyReactive ? "QUARANTINED" : "USABLE";
    action = anyReactive ? "Screening reactive" : "Screening passed";
  } else {
    screeningStatus = anyReactive ? "REACTIVE" : "PASSED";
    newStatus = anyReactive ? "NOT_USABLE" : "USABLE";
    action = anyReactive ? "Confirmatory test positive" : "Confirmatory test cleared";
  }
  const resultText = anyReactive ? `${reactive.length} Reactive — ${shortNames}` : "All Non-Reactive";
  const testingDate = data.testingDate ?? manilaTodayString();

  await prisma.$transaction(async (tx) => {
    await tx.testRecord.create({
      data: {
        unitId: unit.id,
        testingDate: toDbDate(testingDate),
        screeningStatus,
        result: resultText,
        usabilityStatus: newStatus,
        testedById: actor.id,
        results: {
          create: data.tests.map((t) => ({ name: t.name, result: t.result, passed: t.result === "Non-Reactive" })),
        },
      },
    });
    await tx.bloodUnit.update({ where: { id: unit.id }, data: { status: newStatus, testingStatus: screeningStatus } });
    await tx.unitActivity.create({
      data: {
        unitId: unit.id,
        action,
        note: `${resultText}. Unit is now ${UNIT_STATUS_LABEL[newStatus]}.`,
        performedById: actor.id,
      },
    });
    // The audit trail is read by system administrators, so it names the unit
    // and the outcome only: never the donor or which disease test was reactive.
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Test Result Recorded",
      details: `${action} for unit ${unit.id}; status is now ${UNIT_STATUS_LABEL[newStatus]}`,
      ipAddress: req.ip,
    });
  });

  const [updated, record] = await Promise.all([
    loadUnit(unit.id),
    prisma.testRecord.findFirst({
      where: { unitId: unit.id },
      include: testRecordInclude,
      orderBy: { id: "desc" },
    }),
  ]);
  res.status(201).json({
    unit: serializeUnit(updated, await latestActivity(unit.id)),
    testRecord: serializeTestRecord(record!),
  });
});

// Manual status change for situations testing doesn't cover (hold a unit,
// discard a damaged bag, release a hold). Always needs a reason, and keeps
// the safety rules: nothing becomes Usable without passing testing.
export const changeUnitStatus = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const { status: to, reason } = statusSchema.parse(req.body);
  await sweepExpiredUnits();
  const unit = await loadUnit(String(req.params.id));
  const from = unit.status;

  if (from === "EXPIRED" || from === "NOT_USABLE" || from === "ISSUED") {
    throw new AppError(409, `This unit is ${UNIT_STATUS_LABEL[from]}; that status is final and cannot be changed.`);
  }
  if (to === from) throw new AppError(409, `This unit is already ${UNIT_STATUS_LABEL[to]}.`);
  if (to === "EXPIRED") throw new AppError(409, "Units are marked Expired automatically when their date passes.");
  if (to === "PENDING_TESTING") throw new AppError(409, "A unit cannot be sent back to Pending Testing.");
  if (to === "USABLE" && !(from === "QUARANTINED" && (unit.testingStatus === "PASSED" || unit.testingStatus === "COMPLETED"))) {
    throw new AppError(409, "A unit can only be made Usable after it has passed testing. Record its test results instead.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bloodUnit.update({ where: { id: unit.id }, data: { status: to } });
    await tx.unitActivity.create({
      data: {
        unitId: unit.id,
        action: "Status changed",
        note: `${UNIT_STATUS_LABEL[from]} → ${UNIT_STATUS_LABEL[to]}: ${reason}`,
        performedById: actor.id,
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Blood Unit Status Changed",
      details: `Unit ${unit.id}: ${UNIT_STATUS_LABEL[from]} → ${UNIT_STATUS_LABEL[to]}`,
      ipAddress: req.ip,
    });
  });

  const updated = await loadUnit(unit.id);
  res.json({ unit: serializeUnit(updated, await latestActivity(unit.id)) });
});

export const updateUnitStorage = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = storageSchema.parse(req.body);
  const unit = await loadUnit(String(req.params.id));

  const parts: string[] = [];
  if (data.storageLocation !== undefined) parts.push(`location ${data.storageLocation}`);
  if (data.shelf !== undefined) parts.push(`shelf ${data.shelf}`);
  if (data.position !== undefined) parts.push(`position ${data.position}`);

  await prisma.$transaction(async (tx) => {
    await tx.bloodUnit.update({
      where: { id: unit.id },
      data: { storageLocation: data.storageLocation, shelf: data.shelf, position: data.position },
    });
    await tx.unitActivity.create({
      data: { unitId: unit.id, action: "Storage updated", note: `Set ${parts.join(", ")}`, performedById: actor.id },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Blood Unit Storage Updated",
      details: `Updated storage details for unit ${unit.id}`,
      ipAddress: req.ip,
    });
  });

  const updated = await loadUnit(unit.id);
  res.json({ unit: serializeUnit(updated, await latestActivity(unit.id)) });
});

// Lifecycle notes that don't change a unit's status: processing steps, and
// physical disposal of units that are already Not Usable or Expired.
export const addUnitActivity = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = activitySchema.parse(req.body);
  await sweepExpiredUnits();
  const unit = await loadUnit(String(req.params.id));

  if (data.action === "Disposed") {
    if (unit.status !== "NOT_USABLE" && unit.status !== "EXPIRED") {
      throw new AppError(409, "Only Not Usable or Expired units can be recorded as disposed.");
    }
    const already = await prisma.unitActivity.findFirst({ where: { unitId: unit.id, action: "Disposed" } });
    if (already) throw new AppError(409, "This unit is already recorded as disposed.");
  } else if (unit.status === "NOT_USABLE" || unit.status === "EXPIRED" || unit.status === "ISSUED") {
    throw new AppError(409, "A Not Usable, Expired or Issued unit cannot be processed.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.unitActivity.create({
      data: { unitId: unit.id, action: data.action, note: data.note ?? "", performedById: actor.id },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: `Blood Unit ${data.action}`,
      details: `Recorded "${data.action}" for unit ${unit.id}`,
      ipAddress: req.ip,
    });
  });

  const updated = await loadUnit(unit.id);
  res.status(201).json({ unit: serializeUnit(updated, await latestActivity(unit.id)) });
});

// Blood given out: issued or released to a hospital or the DOH. Only a Usable
// unit (passed all screening, not expired) can be issued. Issued is final: the
// unit leaves the inventory and stays in the traceability trail.
export const issueUnit = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = issueSchema.parse(req.body);
  await sweepExpiredUnits();
  const unit = await loadUnit(String(req.params.id));

  if (unit.status === "ISSUED") throw new AppError(409, "This unit has already been issued.");
  if (unit.status !== "USABLE") {
    throw new AppError(409, `Only Usable units can be issued. This unit is ${UNIT_STATUS_LABEL[unit.status]}.`);
  }

  const when = data.issuedDate ?? fromDbDate(manilaToday());
  const note = `Issued to ${data.issuedTo} on ${when}${data.note ? `: ${data.note}` : ""}`;

  await prisma.$transaction(async (tx) => {
    await tx.bloodUnit.update({ where: { id: unit.id }, data: { status: "ISSUED" } });
    await tx.unitActivity.create({
      data: { unitId: unit.id, action: "Issued", note, performedById: actor.id },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Blood Unit Issued",
      details: `Unit ${unit.id} issued to ${data.issuedTo}`,
      ipAddress: req.ip,
    });
  });

  const updated = await loadUnit(unit.id);
  res.status(201).json({ unit: serializeUnit(updated, await latestActivity(unit.id)) });
});
