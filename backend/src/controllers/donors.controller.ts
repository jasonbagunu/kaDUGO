import { z } from "zod";
import type { Donor, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { fromDbDate, toDbDate } from "../lib/dates";
import { contactNumber, optionalEmail, pastDate } from "../lib/validators";
import {
  BLOOD_TYPE_LABEL, COMPONENT_LABEL, DONATION_STATUS_LABEL, DONOR_STATUS_LABEL,
  SEX_LABEL, UNIT_STATUS_LABEL,
  bloodTypeInput, donorStatusInput, sexInput,
} from "../lib/labels";

// ───────────── validation ─────────────
// No .default() anywhere: zod 3 and zod 4 treat defaults differently, so
// defaults are applied in the handlers instead.

const donorFields = {
  name: z.string().trim().min(2, "Enter the donor's full name.").max(100, "Name is too long."),
  dob: pastDate("Date of birth cannot be in the future."),
  sex: sexInput,
  bloodType: bloodTypeInput,
  contact: contactNumber,
  email: optionalEmail,
  address: z.string().trim().min(1, "Address is required.").max(255, "Address is too long."),
  status: donorStatusInput,
};

const createSchema = z.object({
  ...donorFields,
  email: donorFields.email.optional(),
  status: donorFields.status.optional(),
});

const updateSchema = z.object(donorFields).partial();

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  bloodType: bloodTypeInput.optional(),
  status: donorStatusInput.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

// ───────────── shared helpers (also used by pre-registrations) ─────────────

export interface DonorStats {
  totalDonations: number;
  lastDonation: string | null;
}

// A donor's totals are counted from their completed donations, never stored.
export async function statsForDonors(ids: string[]): Promise<Map<string, DonorStats>> {
  const result = new Map<string, DonorStats>();
  for (const id of ids) result.set(id, { totalDonations: 0, lastDonation: null });
  if (ids.length === 0) return result;

  const rows = await prisma.donation.groupBy({
    by: ["donorId"],
    where: { donorId: { in: ids }, status: "COMPLETED" },
    _count: { _all: true },
    _max: { date: true },
  });
  for (const row of rows) {
    result.set(row.donorId, {
      totalDonations: row._count._all,
      lastDonation: row._max.date ? fromDbDate(row._max.date) : null,
    });
  }
  return result;
}

export function serializeDonor(d: Donor, stats: DonorStats) {
  return {
    id: d.id,
    name: d.name,
    dob: fromDbDate(d.dob),
    sex: SEX_LABEL[d.sex],
    bloodType: BLOOD_TYPE_LABEL[d.bloodType],
    contact: d.contact,
    email: d.email,
    address: d.address,
    status: DONOR_STATUS_LABEL[d.status],
    registrationDate: d.registeredAt.toISOString().slice(0, 10),
    ...stats,
  };
}

// Same name and birth date = almost certainly the same person.
export async function findMatchingDonor(name: string, dob: string, excludeId?: string) {
  return prisma.donor.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      dob: toDbDate(dob),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

// ───────────── handlers ─────────────

export const listDonors = asyncHandler(async (req, res) => {
  const { search, bloodType, status, page, pageSize } = listQuerySchema.parse(req.query);

  const where: Prisma.DonorWhereInput = {
    ...(bloodType ? { bloodType } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
            { contact: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [donors, total] = await Promise.all([
    prisma.donor.findMany({ where, orderBy: { registeredAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.donor.count({ where }),
  ]);
  const stats = await statsForDonors(donors.map((d) => d.id));

  res.json({ items: donors.map((d) => serializeDonor(d, stats.get(d.id)!)), total, page, pageSize });
});

// One donor plus their donation history.
export const getDonor = asyncHandler(async (req, res) => {
  const donor = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!donor) throw new AppError(404, "Donor not found.");

  const [stats, donations] = await Promise.all([
    statsForDonors([donor.id]),
    prisma.donation.findMany({
      where: { donorId: donor.id },
      orderBy: { date: "desc" },
      include: {
        event: { select: { name: true } },
        bloodUnit: { select: { id: true, component: true, status: true } },
      },
    }),
  ]);

  res.json({
    donor: serializeDonor(donor, stats.get(donor.id)!),
    donations: donations.map((d) => ({
      id: d.id,
      date: fromDbDate(d.date),
      bloodType: BLOOD_TYPE_LABEL[d.bloodType],
      status: DONATION_STATUS_LABEL[d.status],
      notes: d.notes,
      eventId: d.eventId,
      eventName: d.event?.name ?? null,
      bloodUnitId: d.bloodUnit?.id ?? null,
      component: d.bloodUnit ? COMPONENT_LABEL[d.bloodUnit.component] : null,
      unitStatus: d.bloodUnit ? UNIT_STATUS_LABEL[d.bloodUnit.status] : null,
    })),
  });
});

export const createDonor = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = createSchema.parse(req.body);

  const duplicate = await findMatchingDonor(data.name, data.dob);
  if (duplicate) {
    throw new AppError(409, `A donor with the same name and birth date already exists (${duplicate.id}).`);
  }

  const donor = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "donor", "DNR-", 5);
    const created = await tx.donor.create({
      data: {
        id,
        name: data.name,
        dob: toDbDate(data.dob),
        sex: data.sex,
        bloodType: data.bloodType,
        contact: data.contact,
        email: data.email ?? "",
        address: data.address,
        status: data.status ?? "ACTIVE",
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Registered",
      details: `Registered donor ${created.id}`,
      ipAddress: req.ip,
    });
    return created;
  });

  res.status(201).json({ donor: serializeDonor(donor, { totalDonations: 0, lastDonation: null }) });
});

export const updateDonor = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateSchema.parse(req.body);
  const existing = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, "Donor not found.");

  if (data.name !== undefined || data.dob !== undefined) {
    const duplicate = await findMatchingDonor(data.name ?? existing.name, data.dob ?? fromDbDate(existing.dob), existing.id);
    if (duplicate) {
      throw new AppError(409, `Another donor with the same name and birth date already exists (${duplicate.id}).`);
    }
  }

  const donor = await prisma.$transaction(async (tx) => {
    const updated = await tx.donor.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        dob: data.dob ? toDbDate(data.dob) : undefined,
        sex: data.sex,
        bloodType: data.bloodType,
        contact: data.contact,
        email: data.email,
        address: data.address,
        status: data.status,
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Updated",
      details: `Updated donor ${updated.id}: ${Object.keys(data).join(", ") || "no fields"}`,
      ipAddress: req.ip,
    });
    return updated;
  });

  const stats = await statsForDonors([donor.id]);
  res.json({ donor: serializeDonor(donor, stats.get(donor.id)!) });
});

// A donor who has any donation record can never be deleted: the donation and
// its blood unit must stay traceable. Use status "Inactive" instead.
export const deleteDonor = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const donor = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!donor) throw new AppError(404, "Donor not found.");

  const donationCount = await prisma.donation.count({ where: { donorId: donor.id } });
  if (donationCount > 0) {
    throw new AppError(409, "This donor has donation records and cannot be deleted. Set their status to Inactive instead.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.donor.delete({ where: { id: donor.id } });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Deleted",
      details: `Deleted donor ${donor.id}`,
      ipAddress: req.ip,
    });
  });

  res.json({ message: "Donor deleted." });
});
