/*
  Warnings:

  - A unique constraint covering the columns `[donorId,eventId]` on the table `donations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dedupeKey]` on the table `donors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eventId,dedupeKey]` on the table `pre_registrations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "donation_events" ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "facebookUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "messengerUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "otherPlatforms" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "donors" ADD COLUMN     "addressDetails" JSONB,
ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "pre_registrations" ADD COLUMN     "addressDetails" JSONB,
ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "donations_donorId_eventId_key" ON "donations"("donorId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "donors_dedupeKey_key" ON "donors"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "pre_registrations_eventId_dedupeKey_key" ON "pre_registrations"("eventId", "dedupeKey");
