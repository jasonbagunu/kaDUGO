// Age and donor-age rules. Mirrors the backend (lib/eligibility.ts), which has the final say.
// Source: BRL Bureau Order No. 5, s. 1990: donors are 16-65 years old; donors under 18 need
// written parental or guardian consent; people outside the range need a physician's evaluation.
export const DONOR_AGE = { min: 16, max: 65, consentBelow: 18 } as const;

export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Age in whole years on today's date, or null while the date is incomplete or in the future.
export function ageFromDob(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob > todayLocal()) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

export type AgeLevel = "ok" | "info" | "warning" | "blocked";

export function ageNotice(age: number | null): { level: AgeLevel; message: string } | null {
  if (age === null) return null;
  if (age < DONOR_AGE.min) return { level: "blocked", message: `Donors must be at least ${DONOR_AGE.min} years old.` };
  if (age > DONOR_AGE.max) {
    return { level: "warning", message: `Donors are usually accepted up to ${DONOR_AGE.max} years old. A physician must evaluate this donor before donating.` };
  }
  if (age < DONOR_AGE.consentBelow) {
    return { level: "info", message: `Donors under ${DONOR_AGE.consentBelow} need written parental or guardian consent.` };
  }
  return null;
}
