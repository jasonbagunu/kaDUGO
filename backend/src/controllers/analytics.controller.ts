import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { RANGES, getOverview } from "../lib/analytics";

const querySchema = z.object({
  range: z.enum(RANGES, { message: `Range must be one of: ${RANGES.join(", ")}.` }).optional(),
});

export const analyticsOverview = asyncHandler(async (req, res) => {
  const { range } = querySchema.parse(req.query);
  res.json(await getOverview(range ?? "last-6-months"));
});
