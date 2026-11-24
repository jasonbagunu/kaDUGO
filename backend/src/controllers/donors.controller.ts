import { z } from "zod";
import type { Donor, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { fromDbDate, toDbDate } from "../lib/dates";
import { optionalEmail, pastDate, phMobile } from "../lib/validators";
import { addressInputSchema, resolveAddress, shortAddress, type AddressDetails } from "../lib/address";
import { DONOR_AGE, ageOn, checkAge, computeEligibility, eligibilityForDonors, lastDonations, type Eligibility } from "../lib/eligibility";
import { dedupeKey, findDonorMatches, type DonorMatch } from "../lib/donorMatch";
import { hasValidReveal } from "../lib/reveal";
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
  contact: phMobile,
  email: optionalEmail,
  address: addressInputSchema,
  status: donorStatusInput,
};

const reviewFlags = {
  // Staff confirm a physician has evaluated a donor outside the usual age range.
  confirmAgeException: z.boolean().optional(),
  // Staff reviewed the possible duplicates shown and still want to create the donor.
  confirmNotDuplicate: z.boolean().optional(),
};

const createSchema = z.object({
  ...donorFields,
  email: donorFields.email.optional(),
  status: donorFields.status.optional(),
  ...reviewFlags,
});

const updateSchema = z.object({ ...donorFields, ...reviewFlags }).partial();

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  bloodType: bloodTypeInput.optional(),
  status: donorStatusInput.optional(),
  sort: z.enum(["newest", "oldest", "name"]).optional(),
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

// ── masking: protected details are hidden until the person confirms their password ──
const maskContact = (c: string) => (c.length >= 7 ? `${c.slice(0, 2)}${"•".repeat(c.length - 6)}${c.slice(-4)}` : "•••••");
const maskEmail = (e: string) => {
  if (!e) return "";
  const [user, domain] = e.split("@");
  return domain ? `${user.slice(0, 1)}${"•".repeat(Math.max(2, user.length - 1))}@${domain}` : "•••••";
};

export interface DonorExtras {
  eligibility: Eligibility;
}

// Safe summary: no birth date, full contact number, email or street address.
export function serializeDonor(d: Donor, stats: DonorStats, extras?: DonorExtras) {
  const eligibility = extras?.eligibility ?? computeEligibility(
    stats.lastDonation ? { date: toDbDate(stats.lastDonation), component: "WHOLE_BLOOD" } : null,
    d.status,
  );
  return {
    id: d.id,
    name: d.name,
    age: ageOn(d.dob),
    sex: SEX_LABEL[d.sex],
    bloodType: BLOOD_TYPE_LABEL[d.bloodType],
    contact: maskContact(d.contact),
    email: maskEmail(d.email),
    address: shortAddress(d.addressDetails, d.address),
    status: DONOR_STATUS_LABEL[d.status],
    registrationDate: d.registeredAt.toISOString().slice(0, 10),
    eligibility,
    ...stats,
  };
}

// Everything, including the protected details. Only sent after password confirmation.
export function serializeDonorSensitive(d: Donor) {
  return {
    id: d.id,
    dob: fromDbDate(d.dob),
    age: ageOn(d.dob),
    contact: d.contact,
    email: d.email,
    address: d.address,
    addressDetails: (d.addressDetails as unknown as AddressDetails | null) ?? null,
  };
}

// Kept for older callers: the strict "same person" check.
export async function findMatchingDonor(name: string, dob: string, excludeId?: string) {
  const matches = await findDonorMatches({ name, dob }, excludeId);
  return matches.find((m) => m.level === "exact")?.donor ?? null;
}

function describeMatches(matches: DonorMatch[]) {
  return matches.map((m) => ({
    id: m.donor.id,
    name: m.donor.name,
    age: ageOn(m.donor.dob),
    bloodType: BLOOD_TYPE_LABEL[m.donor.bloodType],
    contact: maskContact(m.donor.contact),
    registrationDate: m.donor.registeredAt.toISOString().slice(0, 10),
    level: m.level,
    reason: m.reason,
  }));
}

// Stops a donor being created or changed into a duplicate. Exact matches are always
// refused; "possible" matches are shown to staff, who may confirm and continue.
async function assertNoDuplicates(
  input: { name: string; dob: string; contact: string },
  confirmed: boolean | undefined,
  excludeId?: string,
) {
  const matches = await findDonorMatches(input, excludeId);
  const exact = matches.filter((m) => m.level === "exact");
  if (exact.length > 0) {
    throw new AppError(409, `This donor already exists (${exact[0].donor.id}). Open the existing record instead of creating another one.`, {
      code: "DUPLICATE_DONOR",
      duplicates: describeMatches(exact),
    });
  }
  if (matches.length > 0 && !confirmed) {
    throw new AppError(409, "Possible duplicate donor found. Review the matching records before saving.", {
      code: "POSSIBLE_DUPLICATE",
      duplicates: describeMatches(matches),
    });
  }
}

function assertAgeAllowed(dob: string, confirmed: boolean | undefined) {
  const check = checkAge(ageOn(dob));
  if (check.age < DONOR_AGE.min) {
    throw new AppError(400, check.message!, { code: "AGE_NOT_ALLOWED" });
  }
  if (check.age > DONOR_AGE.max && !confirmed) {
    throw new AppError(400, check.message!, { code: "AGE_EXCEPTION_REQUIRED" });
  }
  return check;
}

// ───────────── handlers ─────────────

export const listDonors = asyncHandler(async (req, res) => {
  const { search, bloodType, status, sort, page, pageSize } = listQuerySchema.parse(req.query);

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
  const orderBy: Prisma.DonorOrderByWithRelationInput =
    sort === "oldest" ? { registeredAt: "asc" } : sort === "name" ? { name: "asc" } : { registeredAt: "desc" };

  const [donors, total] = await Promise.all([
    prisma.donor.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.donor.count({ where }),
  ]);
  const [stats, eligibility] = await Promise.all([
    statsForDonors(donors.map((d) => d.id)),
    eligibilityForDonors(donors),
  ]);

  res.json({
    items: donors.map((d) => serializeDonor(d, stats.get(d.id)!, { eligibility: eligibility.get(d.id)! })),
    total, page, pageSize,
  });
});

// One donor plus their donation history.
export const getDonor = asyncHandler(async (req, res) => {
  const donor = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!donor) throw new AppError(404, "Donor not found.");

  const [stats, eligibility, donations] = await Promise.all([
    statsForDonors([donor.id]),
    eligibilityForDonors([donor]),
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
    donor: serializeDonor(donor, stats.get(donor.id)!, { eligibility: eligibility.get(donor.id)! }),
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

// Protected details of one donor. The route requires a valid reveal token (the
// person typed their password again); every view is written to the audit log.
export const getDonorSensitive = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const donor = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!donor) throw new AppError(404, "Donor not found.");

  await logAudit(prisma, {
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    action: "Sensitive Donor Information Viewed",
    details: `Viewed protected details of donor ${donor.id}`,
    ipAddress: req.ip,
  });

  res.json({ sensitive: serializeDonorSensitive(donor) });
});

export const createDonor = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = createSchema.parse(req.body);

  const ageCheck = assertAgeAllowed(data.dob, data.confirmAgeException);
  const { address, details } = resolveAddress(data.address);
  await assertNoDuplicates({ name: data.name, dob: data.dob, contact: data.contact }, data.confirmNotDuplicate);

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
        address,
        addressDetails: details as unknown as Prisma.InputJsonValue,
        dedupeKey: dedupeKey(data.name, data.dob),
        status: data.status ?? "ACTIVE",
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Registered",
      details: `Registered donor ${created.id}${!ageCheck.withinRange ? " (age exception confirmed)" : ""}${data.confirmNotDuplicate ? " (possible duplicates reviewed)" : ""}`,
      ipAddress: req.ip,
    });
    return created;
  });

  res.status(201).json({
    donor: serializeDonor(donor, { totalDonations: 0, lastDonation: null }),
    ageNotice: ageCheck.message,
  });
});

const SENSITIVE_KEYS = ["dob", "contact", "email", "address"] as const;

export const updateDonor = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateSchema.parse(req.body);
  const existing = await prisma.donor.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, "Donor not found.");

  // Changing protected details needs the password confirmation first.
  if (SENSITIVE_KEYS.some((k) => data[k] !== undefined) && !hasValidReveal(req)) {
    throw new AppError(403, "Confirm your password before changing protected donor details.", { code: "REAUTH_REQUIRED" });
  }

  const nextName = data.name ?? existing.name;
  const nextDob = data.dob ?? fromDbDate(existing.dob);
  const nextContact = data.contact ?? existing.contact;

  if (data.dob !== undefined) assertAgeAllowed(data.dob, data.confirmAgeException);
  if (data.name !== undefined || data.dob !== undefined || data.contact !== undefined) {
    await assertNoDuplicates({ name: nextName, dob: nextDob, contact: nextContact }, data.confirmNotDuplicate, existing.id);
  }
  const resolved = data.address ? resolveAddress(data.address) : null;

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
        ...(resolved ? { address: resolved.address, addressDetails: resolved.details as unknown as Prisma.InputJsonValue } : {}),
        ...(data.name !== undefined || data.dob !== undefined ? { dedupeKey: dedupeKey(nextName, nextDob) } : {}),
        status: data.status,
      },
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Donor Updated",
      details: `Updated donor ${updated.id}: ${Object.keys(data).filter((k) => !k.startsWith("confirm")).join(", ") || "no fields"}`,
      ipAddress: req.ip,
    });
    return updated;
  });

  const [stats, eligibility] = await Promise.all([statsForDonors([donor.id]), eligibilityForDonors([donor])]);
  res.json({ donor: serializeDonor(donor, stats.get(donor.id)!, { eligibility: eligibility.get(donor.id)! }) });
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
