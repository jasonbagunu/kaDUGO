import type { Prisma } from "@prisma/client";

// Builds readable IDs such as USR-002 or DNR-00125.
// Must run inside a transaction: the counter row is locked until the
// transaction ends, so two people saving at the same time never get the
// same number.
export async function nextId(
  tx: Prisma.TransactionClient,
  counterName: string,
  prefix: string,
  pad: number
): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { name: counterName },
    update: { value: { increment: 1 } },
    create: { name: counterName, value: 1 },
  });
  return `${prefix}${String(counter.value).padStart(pad, "0")}`;
}
