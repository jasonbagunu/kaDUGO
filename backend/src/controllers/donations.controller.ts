import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { fromDbDate, toDbDate } from "../lib/dates";
import { addDays, SHELF_LIFE_DAYS } from "../lib/shelfLife";
import { emptyToUndefined, pastDate } from "../lib/validators";
import {
  BLOOD_TYPE_LABEL, COMPONENT_LABEL, DONATION_STATUS_LABEL, TESTING_STATUS_LABEL, UNIT_STATUS_LABEL,
  bloodTypeInput, componentInput, donationStatusInput, testingStatusInput,
} from "../lib/labels";

// ───────────── validation ─────────────

const optionalId = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const createSchema = z.object({
  donorId: z.string().trim().min(1, "Choose a donor."),
  eventId: optionalId, // blank = walk-in with no event
  preRegId: optionalId,
  date: pastDate("Donation date cannot be in the future."),
  bloodType: bloodTypeInput.optional(), // defaults to the donor's blood type
  component: componentInput.optional(), // defaults to Whole Blood
  status: donationStatusInput.optional(), // defaults to Completed
  personnel: z.string().trim().max(100, "Personnel name is too long.").optional(),
  notes: z.string().trim().max(1000, "Notes are too long.").optional(),
});

const listQuerySchema = z.object({
  donorId: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
  status: donationStatusInput.optional(),
  testingStatus: testingStatusInput.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

// ───────────── shape of what we send back ─────────────

const donationInclude = {
  donor: { select: { name: true } },
  event: { select: { name: true } },
  bloodUnit: {
    select: {
      id: true, component: true, status: true, testingStatus: true,
      expirationDate: true, storageLocation: true,
    },
  },
} satisfies Prisma.DonationInclude;

type DonationFull = Prisma.DonationGetPayload<{ include: typeof donationInclude }>;

function serializeDonation(d: DonationFull) {
  return {
    id: d.id,
    donorId: d.donorId,
    donorName: d.donor.name,
    eventId: d.eventId,
    eventName: d.event?.name ?? null,
    preRegId: d.preRegId,
    date: fromDbDate(d.date),
    bloodType: BLOOD_TYPE_LABEL[d.bloodType],
    status: DONATION_STATUS_LABEL[d.status],
    personnel: d.personnel,
    notes: d.notes,
    bloodUnitId: d.bloodUnit?.id ?? null,
    bloodUnit: d.bloodUnit
      ? {
          id: d.bloodUnit.id,
          component: COMPONENT_LABEL[d.bloodUnit.component],
          status: UNIT_STATUS_LABEL[d.bloodUnit.status],
          testingStatus: TESTING_STATUS_LABEL[d.bloodUnit.testingStatus],
          expirationDate: fromDbDate(d.bloodUnit.expirationDate),
          storageLocation: d.bloodUnit.storageLocation,
        }
      : null,
    createdAt: d.createdAt,
  };
}

// ───────────── handlers (Admin and MedTech) ─────────────

export const listDonations = asyncHandler(async (req, res) => {
  const { donorId, eventId, status, testingStatus, search, page, pageSize } = listQuerySchema.parse(req.query);

  const where: Prisma.DonationWhereInput = {
    ...(donorId ? { donorId } : {}),
    ...(eventId ? { eventId } : {}),
    ...(status ? { status } : {}),
    ...(testingStatus ? { bloodUnit: { testingStatus } } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { donor: { name: { contains: search, mode: "insensitive" } } },
            { bloodUnit: { id: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      include: donationInclude,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.donation.count({ where }),
  ]);

  res.json({ items: rows.map(serializeDonation), total, page, pageSize });
});

export const getDonation = asyncHandler(async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: String(req.params.id) },
    include: donationInclude,
  });
  if (!donation) throw new AppError(404, "Donation not found.");
  res.json({ donation: serializeDonation(donation) });
});

// Records a donation. A Completed donation automatically creates its blood
// unit (Pending Testing) with the expiry date for the chosen component, and
// starts the unit's traceability history.
export const createDonation = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = createSchema.parse(req.body);

  // ── checks before anything is written ──
  const donor = await prisma.donor.findUnique({ where: { id: data.donorId } });
  if (!donor) throw new AppError(404, "Donor not found.");
  if (donor.status === "DEFERRED") {
    throw new AppError(409, "This donor is currently deferred and cannot donate. Change their status to Active first if the deferral has ended.");
  }
  if (donor.status === "INACTIVE") {
    throw new AppError(409, "This donor is inactive. Change their status to Active before recording a donation.");
  }

  const bloodType = data.bloodType ?? donor.bloodType;
  if (bloodType !== donor.bloodType) {
    throw new AppError(
      400,
      `Blood type ${BLOOD_TYPE_LABEL[bloodType]} does not match the donor's recorded type (${BLOOD_TYPE_LABEL[donor.bloodType]}). Correct the donor record first if it was entered wrongly.`
    );
  }

  const preReg = data.preRegId
    ? await prisma.preRegistration.findUnique({
        where: { id: data.preRegId },
        include: { donation: { select: { id: true } } },
      })
    : null;
  if (data.preRegId && !preReg) throw new AppError(404, "Pre-registration not found.");
  if (preReg) {
    if (preReg.donation) throw new AppError(409, "This pre-registration already has a donation record.");
    if (preReg.attendance === "DID_NOT_ARRIVE") {
      throw new AppError(409, "This person is marked as Did Not Arrive. Update their attendance first.");
    }
    if (preReg.donorId && preReg.donorId !== donor.id) {
      throw new AppError(400, "This pre-registration is linked to a different donor.");
    }
    if (data.eventId && data.eventId !== preReg.eventId) {
      throw new AppError(400, "This pre-registration belongs to a different event.");
    }
  }

  // A pre-registration brings its event along.
  const eventId = data.eventId ?? preReg?.eventId;
  if (eventId) {
    const event = await prisma.donationEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(404, "Event not found.");
    if (event.status === "CANCELLED") throw new AppError(409, "This event was cancelled.");
  }

  const status = data.status ?? "COMPLETED";
  const component = data.component ?? "WHOLE_BLOOD";
  const year = Number(data.date.slice(0, 4));

  // ── write everything together, or nothing ──
  const donationId = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, `donation-${year}`, `DON-${year}-`, 5);
    await tx.donation.create({
      data: {
        id,
        donorId: donor.id,
        eventId: eventId ?? null,
        preRegId: preReg?.id ?? null,
        date: toDbDate(data.date),
        bloodType,
        status,
        personnel: data.personnel ?? "",
        notes: data.notes ?? "",
        recordedById: actor.id,
      },
    });

    // Only a completed donation produces something to put in a bag and test.
    let unitId: string | null = null;
    if (status === "COMPLETED") {
      unitId = await nextId(tx, `bloodunit-${year}`, `BLD-${year}-`, 6);
      const collected = toDbDate(data.date);
      await tx.bloodUnit.create({
        data: {
          id: unitId,
          donationId: id,
          bloodType,
          component,
          collectionDate: collected,
          expirationDate: addDays(collected, SHELF_LIFE_DAYS[component]),
        },
      });
      await tx.unitActivity.create({
        data: {
          unitId,
          action: "Collected",
          note: `${COMPONENT_LABEL[component]} collected from ${donor.name}`,
          performedById: actor.id,
        },
      });
    }

    // Keep the pre-registration in step with what happened.
    if (preReg) {
      const outcome = status === "COMPLETED" ? "DONATED" : status === "DEFERRED" ? "DEFERRED" : "DID_NOT_DONATE";
      await tx.preRegistration.update({
        where: { id: preReg.id },
        data: {
          donorId: donor.id,
          attendance: "ARRIVED",
          outcome,
          ...(preReg.attendance === "PRE_REGISTERED" ? { verifiedAt: new Date(), verifiedById: actor.id } : {}),
        },
      });
    }

    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donation Recorded",
      details: unitId
        ? `Donation ${id} (${COMPONENT_LABEL[component]}) recorded for donor ${donor.id}; blood unit ${unitId} created`
        : `Donation ${id} recorded for donor ${donor.id} with status ${DONATION_STATUS_LABEL[status]}; no blood unit created`,
      ipAddress: req.ip,
    });

    return id;
  });

  const donation = await prisma.donation.findUnique({ where: { id: donationId }, include: donationInclude });
  res.status(201).json({ donation: serializeDonation(donation!) });
});
