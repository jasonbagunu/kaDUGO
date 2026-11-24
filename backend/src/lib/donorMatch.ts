import type { Donor } from "@prisma/client";
import { prisma } from "./prisma";
import { toDbDate } from "./dates";

// Names are compared without caring about capital letters, accents, punctuation,
// extra spaces or word order ("Dela Cruz, Juan" = "juan  dela cruz").
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// The value stored in the unique `dedupeKey` column: sorted name words + birth date.
export function dedupeKey(name: string, dob: string): string {
  return `${nameTokens(name).sort().join(" ")}|${dob}`;
}

export interface DonorMatch {
  level: "exact" | "possible";
  reason: string;
  donor: Donor;
}

// Finds donors who may be the same person. Names alone are never enough:
//   exact    = same name and same birth date (cannot be created again)
//   possible = same mobile number AND (same birth date OR at least two shared name words),
//              or the same birth date AND at least two shared name words
//              (staff review these and decide)
export async function findDonorMatches(
  input: { name: string; dob: string; contact?: string },
  excludeId?: string,
): Promise<DonorMatch[]> {
  const dob = toDbDate(input.dob);
  const tokens = nameTokens(input.name);
  const key = dedupeKey(input.name, input.dob);
  const notSelf = excludeId ? { id: { not: excludeId } } : {};

  const candidates = await prisma.donor.findMany({
    where: {
      ...notSelf,
      OR: [
        { dedupeKey: key },
        { name: { equals: input.name, mode: "insensitive" }, dob },
        { dob },
        ...(input.contact ? [{ contact: input.contact }] : []),
      ],
    },
    take: 50,
  });

  const matches: DonorMatch[] = [];
  for (const d of candidates) {
    const sameDob = d.dob.getTime() === dob.getTime();
    const theirTokens = nameTokens(d.name);
    const shared = tokens.filter((t) => theirTokens.includes(t)).length;
    const sameName = theirTokens.slice().sort().join(" ") === tokens.slice().sort().join(" ");
    const sameContact = !!input.contact && d.contact === input.contact;

    if (sameName && sameDob) {
      matches.push({ level: "exact", reason: "Same name and birth date", donor: d });
    } else if (sameContact && (sameDob || shared >= 2)) {
      matches.push({
        level: "possible",
        reason: sameDob ? "Same mobile number and birth date" : "Same mobile number and similar name",
        donor: d,
      });
    } else if (sameDob && shared >= 2) {
      matches.push({ level: "possible", reason: "Same birth date and a similar name", donor: d });
    }
  }
  return matches.sort((a, b) => (a.level === b.level ? 0 : a.level === "exact" ? -1 : 1));
}
