import { z } from "zod";
import type {
  Attendance, BloodComponent, BloodType, DonationOutcome, DonationStatus, DonorStatus,
  EventStatus, Sex, TestingStatus, UnitStatus,
} from "@prisma/client";

// The database stores enum names (A_POS, PRE_REGISTERED ...). The frontend
// shows and sends readable labels ("A+", "Pre-registered" ...). These maps
// translate in both directions so the pages need little change.

export const BLOOD_TYPE_LABEL: Record<BloodType, string> = {
  A_POS: "A+", A_NEG: "A-", B_POS: "B+", B_NEG: "B-",
  AB_POS: "AB+", AB_NEG: "AB-", O_POS: "O+", O_NEG: "O-",
};

export const SEX_LABEL: Record<Sex, string> = { MALE: "Male", FEMALE: "Female" };

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  UPCOMING: "Upcoming", ONGOING: "Ongoing", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  PRE_REGISTERED: "Pre-registered", ARRIVED: "Arrived", DID_NOT_ARRIVE: "Did Not Arrive",
};

export const OUTCOME_LABEL: Record<DonationOutcome, string> = {
  NONE: "—", DONATED: "Donated", DID_NOT_DONATE: "Did Not Donate", DEFERRED: "Deferred",
};

export const DONOR_STATUS_LABEL: Record<DonorStatus, string> = {
  ACTIVE: "Active", DEFERRED: "Deferred", INACTIVE: "Inactive",
};

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  COMPLETED: "Completed", DEFERRED: "Deferred", CANCELLED: "Cancelled",
};

export const COMPONENT_LABEL: Record<BloodComponent, string> = {
  WHOLE_BLOOD: "Whole Blood",
  PACKED_RBC: "Packed RBC",
  FRESH_FROZEN_PLASMA: "Fresh Frozen Plasma",
  PLATELET_CONCENTRATE: "Platelet Concentrate",
};

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  PENDING_TESTING: "Pending Testing", USABLE: "Usable", QUARANTINED: "Quarantined",
  NOT_USABLE: "Not Usable", EXPIRED: "Expired", ISSUED: "Issued",
};

export const TESTING_STATUS_LABEL: Record<TestingStatus, string> = {
  PENDING: "Pending", PASSED: "Passed", REACTIVE: "Reactive",
  FOR_CONFIRMATION: "For Confirmation", COMPLETED: "Completed",
};

// A zod schema that accepts the label ("A+") and gives back the enum name (A_POS).
function labelEnum<K extends string>(map: Record<K, string>) {
  const labels = Object.values(map) as [string, ...string[]];
  const reverse = Object.fromEntries(Object.entries(map).map(([key, label]) => [label, key])) as Record<string, K>;
  return z
    .enum(labels, { message: `Must be one of: ${labels.join(", ")}.` })
    .transform((label) => reverse[label]);
}

export const bloodTypeInput = labelEnum(BLOOD_TYPE_LABEL);
export const sexInput = labelEnum(SEX_LABEL);
export const eventStatusInput = labelEnum(EVENT_STATUS_LABEL);
export const attendanceInput = labelEnum(ATTENDANCE_LABEL);
export const outcomeInput = labelEnum(OUTCOME_LABEL);
export const donorStatusInput = labelEnum(DONOR_STATUS_LABEL);
export const donationStatusInput = labelEnum(DONATION_STATUS_LABEL);
export const componentInput = labelEnum(COMPONENT_LABEL);
export const unitStatusInput = labelEnum(UNIT_STATUS_LABEL);
export const testingStatusInput = labelEnum(TESTING_STATUS_LABEL);
