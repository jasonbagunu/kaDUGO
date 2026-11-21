import { asyncHandler } from "../lib/asyncHandler";
import { getInventorySummary } from "../lib/inventory";

// Current stock per blood type, with low-stock and expiring-soon flags.
export const inventorySummary = asyncHandler(async (_req, res) => {
  res.json(await getInventorySummary());
});
