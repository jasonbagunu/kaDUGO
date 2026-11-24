import type { BloodComponent, DonorStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { fromDbDate } from "./dates";
import { addDays } from "./shelfLife";
import { manilaToday } from "./today";

// ───────────── Donor age ─────────────
// Philippine blood bank technical standards (BRL Bureau Order No. 5, s. 1990) list
// the donor age as 16-65 years, and require written parental/guardian consent for
// donors under 18. People outside 16-65 need an evaluation by the blood bank's
// physician, so staff may still record them but only with that confirmation.
export const DONOR_AGE = { min: 16, max: 65, consentBelow: 18 } as const;

export function ageOn(dob: Date | string, today: Date = manilaToday()): number {
  const d = typeof dob === "string" ? new Date(`${dob}T00:00:00.000Z`) : dob;
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < d.getUTCMonth() ||
    (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export interface AgeCheck {
  age: number;
  withinRange: boolean;
  needsParentalConsent: boolean;
  message: string | null;
}

export function checkAge(age: number): AgeCheck {
  const withinRange = age >= DONOR_AGE.min && age <= DONOR_AGE.max;
  const needsParentalConsent = age >= DONOR_AGE.min && age < DONOR_AGE.consentBelow;
  let message: string | null = null;
  if (age < DONOR_AGE.min) message = `Donors must be at least ${DONOR_AGE.min} years old. This person is ${age}.`;
  else if (age > DONOR_AGE.max) message = `Donors are usually accepted up to ${DONOR_AGE.max} years old. This person is ${age}, so the blood bank's physician must evaluate them first.`;
  else if (needsParentalConsent) message = `Donors under ${DONOR_AGE.consentBelow} need written parental or guardian consent.`;
  return { age, withinRange, needsParentalConsent, message };
}

// ───────────── Waiting time between donations ─────────────
// Whole blood: a donor must wait 12 weeks (3 months) after giving a full unit
// (BRL Bureau Order No. 5, s. 1990; the Philippine Red Cross says every 3 months).
// The wait depends on what was collected, so it is kept per donation type. kaDUGO
// records only whole-blood based components (Whole Blood, Packed RBC, Fresh Frozen
// Plasma and Platelet Concentrate made from a whole-blood unit), so all four use
// 84 days. If the center starts collecting by apheresis, set the shorter interval
// its SOP allows here, and nothing else needs to change.
export const DONATION_INTERVAL_DAYS: Record<BloodComponent, number> = {
  WHOLE_BLOOD: 84,
  PACKED_RBC: 84,
  FRESH_FROZEN_PLASMA: 84,
  PLATELET_CONCENTRATE: 84,
};

export interface Eligibility {
  eligible: boolean;
  lastDonationDate: string | null;
  nextEligibleDate: string | null; // first day the donor may donate again
  daysRemaining: number;
  intervalDays: number | null;
  reason: string | null; // why the donor cannot donate right now
}

export function computeEligibility(
  last: { date: Date; component: BloodComponent } | null,
  donorStatus: DonorStatus,
  today: Date = manilaToday(),
): Eligibility {
  let next: Date | null = null;
  let intervalDays: number | null = null;
  if (last) {
    intervalDays = DONATION_INTERVAL_DAYS[last.component];
    next = addDays(last.date, intervalDays);
  }
  const daysRemaining = next ? Math.max(0, Math.ceil((next.getTime() - today.getTime()) / 86_400_000)) : 0;
  const waiting = daysRemaining > 0;

  let reason: string | null = null;
  if (donorStatus === "DEFERRED") reason = "This donor is currently deferred.";
  else if (donorStatus === "INACTIVE") reason = "This donor's record is inactive.";
  else if (waiting && next) {
    reason = `Not yet eligible: ${intervalDays! / 7} weeks must pass after the last donation (${fromDbDate(last!.date)}). Eligible again on ${fromDbDate(next)}.`;
  }

  return {
    eligible: reason === null,
    lastDonationDate: last ? fromDbDate(last.date) : null,
    nextEligibleDate: next ? fromDbDate(next) : null,
    daysRemaining,
    intervalDays,
    reason,
  };
}

// Latest completed donation for each donor (the date and what was collected).
export async function lastDonations(donorIds: string[]) {
  const map = new Map<string, { date: Date; component: BloodComponent }>();
  if (donorIds.length === 0) return map;
  const rows = await prisma.donation.findMany({
    where: { donorId: { in: donorIds }, status: "COMPLETED" },
    orderBy: { date: "desc" },
    select: { donorId: true, date: true, bloodUnit: { select: { component: true } } },
  });
  for (const r of rows) {
    if (!map.has(r.donorId)) map.set(r.donorId, { date: r.date, component: r.bloodUnit?.component ?? "WHOLE_BLOOD" });
  }
  return map;
}

export async function eligibilityForDonors(donors: { id: string; status: DonorStatus }[]) {
  const last = await lastDonations(donors.map((d) => d.id));
  const result = new Map<string, Eligibility>();
  for (const d of donors) result.set(d.id, computeEligibility(last.get(d.id) ?? null, d.status));
  return result;
}
