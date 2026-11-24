import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { logAudit } from "../lib/audit";
import { fromDbDate } from "../lib/dates";
import { nextId } from "../lib/ids";
import { emptyToUndefined } from "../lib/validators";
import { findMatchingDonor, serializeDonor, statsForDonors } from "./donors.controller";
import { dedupeKey } from "../lib/donorMatch";
import {
  ATTENDANCE_LABEL, BLOOD_TYPE_LABEL, OUTCOME_LABEL, SEX_LABEL,
  attendanceInput, bloodTypeInput, outcomeInput,
} from "../lib/labels";

const listQuerySchema = z.object({
  eventId: z.string().trim().optional(),
  attendance: attendanceInput.optional(),
  search: z.string().trim().optional(),
  // "true": only people who are not yet linked to a donor record (used by Donors > Add Donor)
  unregistered: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

const updateSchema = z
  .object({
    attendance: attendanceInput.optional(),
    outcome: outcomeInput.optional(),
  })
  .refine((d) => d.attendance !== undefined || d.outcome !== undefined, {
    message: "Send an attendance and/or outcome to update.",
  });

const withRelations = {
  event: { select: { name: true } },
  donation: { select: { id: true } },
} satisfies Prisma.PreRegistrationInclude;

type PreRegWithRelations = Prisma.PreRegistrationGetPayload<{ include: typeof withRelations }>;

function serialize(p: PreRegWithRelations) {
  return {
    id: p.id,
    eventId: p.eventId,
    eventName: p.event.name,
    name: p.name,
    dob: p.dob ? fromDbDate(p.dob) : null,
    sex: p.sex ? SEX_LABEL[p.sex] : null,
    contact: p.contact,
    email: p.email,
    address: p.address,
    bloodType: p.bloodType ? BLOOD_TYPE_LABEL[p.bloodType] : null,
    registeredAt: p.registeredAt,
    date: p.registeredAt.toISOString().slice(0, 10),
    attendance: ATTENDANCE_LABEL[p.attendance],
    outcome: OUTCOME_LABEL[p.outcome],
    donorId: p.donorId,
    donationId: p.donation?.id ?? null,
    verifiedAt: p.verifiedAt,
  };
}

export const listPreRegistrations = asyncHandler(async (req, res) => {
  const { eventId, attendance, search, unregistered, page, pageSize } = listQuerySchema.parse(req.query);

  const where: Prisma.PreRegistrationWhereInput = {
    ...(eventId ? { eventId } : {}),
    ...(attendance ? { attendance } : {}),
    ...(unregistered === "true" ? { donorId: null } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { contact: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.preRegistration.findMany({
      where,
      include: withRelations,
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.preRegistration.count({ where }),
  ]);

  res.json({ items: rows.map(serialize), total, page, pageSize });
});

// Staff confirm who actually showed up, and what happened with their donation.
export const updatePreRegistration = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateSchema.parse(req.body);

  const existing = await prisma.preRegistration.findUnique({
    where: { id: String(req.params.id) },
    include: withRelations,
  });
  if (!existing) throw new AppError(404, "Pre-registration not found.");

  if (existing.donation) {
    throw new AppError(409, "This person already has a donation record, so their status can no longer be changed here.");
  }

  if (data.outcome === "DONATED") {
    throw new AppError(400, "Donated is set automatically when the donation is recorded. Use Record Donation instead.");
  }

  const attendance = data.attendance ?? existing.attendance;
  let outcome = data.outcome ?? existing.outcome;

  // A donation outcome only makes sense for someone who actually arrived.
  if (attendance !== "ARRIVED") {
    if (data.outcome !== undefined && data.outcome !== "NONE") {
      throw new AppError(400, "Only people marked as Arrived can have a donation outcome.");
    }
    outcome = "NONE";
  }

  const attendanceChanged = attendance !== existing.attendance;
  const confirmed = attendance !== "PRE_REGISTERED";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.preRegistration.update({
      where: { id: existing.id },
      data: {
        attendance,
        outcome,
        // Record who confirmed attendance, and when.
        ...(attendanceChanged
          ? confirmed
            ? { verifiedAt: new Date(), verifiedById: actor.id }
            : { verifiedAt: null, verifiedById: null }
          : {}),
      },
      include: withRelations,
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Attendance Updated",
      details: `${existing.id}: ${ATTENDANCE_LABEL[existing.attendance]} → ${ATTENDANCE_LABEL[attendance]}, outcome ${OUTCOME_LABEL[outcome]}`,
      ipAddress: req.ip,
    });
    return row;
  });

  res.json({ preRegistration: serialize(updated) });
});

// ───────────── register an arrived person as a donor ─────────────

const registerDonorSchema = z.object({
  // Only needed when the person did not know their blood type when signing up.
  bloodType: z.preprocess(emptyToUndefined, bloodTypeInput.optional()),
  // Set by Donors > Add Donor > "From a pre-registration": register before the person has arrived.
  allowNotArrived: z.boolean().optional(),
});

// "Donor is registered/verified": turns an arrived pre-registrant into a donor
// record (or links them to the donor record they already have), so the
// donation can be recorded against it. Admin and MedTech only.
export const registerDonorFromPreReg = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const { bloodType: bloodTypeOverride, allowNotArrived } = registerDonorSchema.parse(req.body ?? {});

  const preReg = await prisma.preRegistration.findUnique({
    where: { id: String(req.params.id) },
    include: withRelations,
  });
  if (!preReg) throw new AppError(404, "Pre-registration not found.");

  // Already done: hand back the existing donor.
  if (preReg.donorId) {
    const existing = await prisma.donor.findUnique({ where: { id: preReg.donorId } });
    if (existing) {
      const stats = await statsForDonors([existing.id]);
      return res.json({ donor: serializeDonor(existing, stats.get(existing.id)!), created: false });
    }
  }

  if (preReg.attendance !== "ARRIVED" && !allowNotArrived) {
    throw new AppError(409, "Mark this person as Arrived before registering them as a donor.");
  }
  if (!preReg.dob || !preReg.sex) {
    throw new AppError(400, "This pre-registration has no birth date or sex. Register the donor manually from the Donors page.");
  }
  const bloodType = bloodTypeOverride ?? preReg.bloodType;
  if (!bloodType) {
    throw new AppError(400, "Blood type is required to register a donor. Send bloodType (for example \"A+\").");
  }

  const dobText = fromDbDate(preReg.dob);
  const match = await findMatchingDonor(preReg.name, dobText);

  const result = await prisma.$transaction(async (tx) => {
    let donor = match;
    let created = false;
    if (!donor) {
      const id = await nextId(tx, "donor", "DNR-", 5);
      donor = await tx.donor.create({
        data: {
          id,
          name: preReg.name,
          dob: preReg.dob!,
          sex: preReg.sex!,
          bloodType,
          contact: preReg.contact,
          email: preReg.email,
          address: preReg.address,
          ...(preReg.addressDetails ? { addressDetails: preReg.addressDetails as Prisma.InputJsonValue } : {}),
          dedupeKey: dedupeKey(preReg.name, dobText),
        },
      });
      created = true;
    }
    await tx.preRegistration.update({ where: { id: preReg.id }, data: { donorId: donor.id } });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Registered",
      details: created
        ? `Registered donor ${donor.id} from pre-registration ${preReg.id}`
        : `Linked pre-registration ${preReg.id} to existing donor ${donor.id}`,
      ipAddress: req.ip,
    });
    return { donor, created };
  });

  const stats = await statsForDonors([result.donor.id]);
  res.status(result.created ? 201 : 200).json({ donor: serializeDonor(result.donor, stats.get(result.donor.id)!), created: result.created });
});
