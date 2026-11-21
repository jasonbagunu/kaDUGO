import type { BloodComponent } from "@prisma/client";

// Days a collected component stays usable. The expiry date of a blood unit is
// its collection date plus this many days.
export const SHELF_LIFE_DAYS: Record<BloodComponent, number> = {
  WHOLE_BLOOD: 35,
  PACKED_RBC: 42,
  FRESH_FROZEN_PLASMA: 365,
  PLATELET_CONCENTRATE: 5,
};

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
