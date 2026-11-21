-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MEDTECH');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- CreateEnum
CREATE TYPE "BloodComponent" AS ENUM ('Whole Blood', 'Packed RBC', 'Fresh Frozen Plasma', 'Platelet Concentrate');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('Pending Testing', 'Usable', 'Quarantined', 'Not Usable', 'Expired');

-- CreateEnum
CREATE TYPE "TestingStatus" AS ENUM ('Pending', 'Passed', 'Reactive', 'For Confirmation', 'Completed');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('ACTIVE', 'DEFERRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('COMPLETED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Attendance" AS ENUM ('Pre-registered', 'Arrived', 'Did Not Arrive');

-- CreateEnum
CREATE TYPE "DonationOutcome" AS ENUM ('—', 'Donated', 'Did Not Donate', 'Deferred');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "organizer" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "publicToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "donation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" DATE,
    "sex" "Sex",
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "bloodType" "BloodType",
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendance" "Attendance" NOT NULL DEFAULT 'Pre-registered',
    "outcome" "DonationOutcome" NOT NULL DEFAULT '—',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "donorId" TEXT,

    CONSTRAINT "pre_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "status" "DonorStatus" NOT NULL DEFAULT 'ACTIVE',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "eventId" TEXT,
    "preRegId" TEXT,
    "date" DATE NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'COMPLETED',
    "personnel" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_units" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL,
    "component" "BloodComponent" NOT NULL DEFAULT 'Whole Blood',
    "collectionDate" DATE NOT NULL,
    "expirationDate" DATE NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'Pending Testing',
    "testingStatus" "TestingStatus" NOT NULL DEFAULT 'Pending',
    "storageLocation" TEXT NOT NULL DEFAULT 'Pending',
    "shelf" TEXT NOT NULL DEFAULT '—',
    "position" TEXT NOT NULL DEFAULT '—',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_records" (
    "id" SERIAL NOT NULL,
    "unitId" TEXT NOT NULL,
    "testingDate" DATE NOT NULL,
    "screeningStatus" "TestingStatus" NOT NULL,
    "result" TEXT NOT NULL,
    "usabilityStatus" "UnitStatus" NOT NULL,
    "testedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" SERIAL NOT NULL,
    "testRecordId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_activities" (
    "id" SERIAL NOT NULL,
    "unitId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,

    CONSTRAINT "unit_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" "Role",
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "donation_events_publicToken_key" ON "donation_events"("publicToken");

-- CreateIndex
CREATE INDEX "donation_events_date_idx" ON "donation_events"("date");

-- CreateIndex
CREATE INDEX "donation_events_status_idx" ON "donation_events"("status");

-- CreateIndex
CREATE INDEX "pre_registrations_eventId_idx" ON "pre_registrations"("eventId");

-- CreateIndex
CREATE INDEX "pre_registrations_attendance_idx" ON "pre_registrations"("attendance");

-- CreateIndex
CREATE INDEX "donors_name_idx" ON "donors"("name");

-- CreateIndex
CREATE INDEX "donors_bloodType_idx" ON "donors"("bloodType");

-- CreateIndex
CREATE UNIQUE INDEX "donations_preRegId_key" ON "donations"("preRegId");

-- CreateIndex
CREATE INDEX "donations_donorId_idx" ON "donations"("donorId");

-- CreateIndex
CREATE INDEX "donations_eventId_idx" ON "donations"("eventId");

-- CreateIndex
CREATE INDEX "donations_date_idx" ON "donations"("date");

-- CreateIndex
CREATE UNIQUE INDEX "blood_units_donationId_key" ON "blood_units"("donationId");

-- CreateIndex
CREATE INDEX "blood_units_status_idx" ON "blood_units"("status");

-- CreateIndex
CREATE INDEX "blood_units_bloodType_status_idx" ON "blood_units"("bloodType", "status");

-- CreateIndex
CREATE INDEX "blood_units_expirationDate_idx" ON "blood_units"("expirationDate");

-- CreateIndex
CREATE INDEX "test_records_unitId_idx" ON "test_records"("unitId");

-- CreateIndex
CREATE INDEX "test_results_testRecordId_idx" ON "test_results"("testRecordId");

-- CreateIndex
CREATE INDEX "unit_activities_unitId_occurredAt_idx" ON "unit_activities"("unitId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_events" ADD CONSTRAINT "donation_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_registrations" ADD CONSTRAINT "pre_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "donation_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_registrations" ADD CONSTRAINT "pre_registrations_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_registrations" ADD CONSTRAINT "pre_registrations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "donation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_preRegId_fkey" FOREIGN KEY ("preRegId") REFERENCES "pre_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_units" ADD CONSTRAINT "blood_units_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "blood_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testRecordId_fkey" FOREIGN KEY ("testRecordId") REFERENCES "test_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_activities" ADD CONSTRAINT "unit_activities_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "blood_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_activities" ADD CONSTRAINT "unit_activities_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
