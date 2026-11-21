// The center works on Philippine time (UTC+8), but the server clock is UTC.
// Without this, "today" would be wrong between midnight and 8 AM local time.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Today's calendar date in the Philippines, as a Date at 00:00 UTC, which is
// the same form PostgreSQL DATE columns are read back in.
export function manilaToday(): Date {
  const shifted = new Date(Date.now() + MANILA_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export const manilaTodayString = () => manilaToday().toISOString().slice(0, 10);
