import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { fromDbDate } from "../lib/dates";
import { BLOOD_TYPE_LABEL, TESTING_STATUS_LABEL, UNIT_STATUS_LABEL, testingStatusInput } from "../lib/labels";

const listQuerySchema = z.object({
  screeningStatus: testingStatusInput.optional(),
  unitId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

const include = {
  results: { orderBy: { id: "asc" } },
  testedBy: { select: { name: true } },
  unit: {
    select: {
      id: true,
      donationId: true,
      bloodType: true,
      donation: { select: { donor: { select: { name: true } } } },
    },
  },
} satisfies Prisma.TestRecordInclude;

// Every screening/testing entry across all units (the Testing page's history).
export const listTestRecords = asyncHandler(async (req, res) => {
  const { screeningStatus, unitId, search, page, pageSize } = listQuerySchema.parse(req.query);

  const where: Prisma.TestRecordWhereInput = {
    ...(screeningStatus ? { screeningStatus } : {}),
    ...(unitId ? { unitId } : {}),
    ...(search
      ? {
          OR: [
            { unitId: { contains: search, mode: "insensitive" } },
            { unit: { donationId: { contains: search, mode: "insensitive" } } },
            { unit: { donation: { donor: { name: { contains: search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.testRecord.findMany({
      where,
      include,
      orderBy: [{ testingDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testRecord.count({ where }),
  ]);

  res.json({
    items: rows.map((t) => ({
      id: t.id,
      unitId: t.unitId,
      donationId: t.unit.donationId,
      donorName: t.unit.donation.donor.name,
      bloodType: BLOOD_TYPE_LABEL[t.unit.bloodType],
      testingDate: fromDbDate(t.testingDate),
      screeningStatus: TESTING_STATUS_LABEL[t.screeningStatus],
      result: t.result,
      usabilityStatus: UNIT_STATUS_LABEL[t.usabilityStatus],
      testedBy: t.testedBy?.name ?? null,
      tests: t.results.map((r) => ({ name: r.name, result: r.result, passed: r.passed })),
    })),
    total,
    page,
    pageSize,
  });
});
