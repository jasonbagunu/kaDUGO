/** Display-only: a blood type with zero available stock reads "No Blood". Data stays numeric. */
export const NO_BLOOD = "No Blood";
export const formatStock = (n: number | null | undefined): string | number => (n === 0 ? NO_BLOOD : n ?? 0);
export const isNoStock = (n: number | null | undefined) => (n ?? 0) === 0;
