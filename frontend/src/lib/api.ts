import type { Role } from "../data/mock";
import { clearSession, getSession, setNotice } from "./session";

// Where the backend lives. Override with VITE_API_URL in frontend/.env
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

// One function for every call to the backend. It attaches the login token,
// turns server error messages into ApiError, and sends the user back to the
// login page when the session has expired or the account was deactivated.
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = getSession();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check that the backend is running.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const serverMessage = data && typeof data.error === "string" ? data.error : null;
    const message =
      serverMessage ??
      (response.status === 401 ? "Your session has expired. Please sign in again." : `Request failed (${response.status}).`);

    // 401 on a signed-in session = expired token or deactivated account.
    // A page often makes several requests at once and they all fail together:
    // only the first one signs out and redirects, so a later (possibly
    // cut-off) response can't overwrite the message.
    if (response.status === 401 && session && getSession() !== null) {
      clearSession();
      setNotice(message);
      window.location.assign("/login");
    }
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

// ───────────── shapes returned by the backend ─────────────

export interface ApiUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: string | null;
  createdAt: string;
  createdById: string | null;
}

export interface LoginResponse {
  token: string;
  user: Pick<ApiUser, "id" | "name" | "username" | "email" | "role" | "status" | "lastLoginAt">;
}

export interface ApiAuditLog {
  id: number;
  code: string;
  timestamp: string;
  userName: string;
  userRole: Role | null;
  action: string;
  details: string;
  ipAddress: string | null;
}

// ───────────── events, pre-registration, donors, donations ─────────────

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiEventStatus = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

export interface ApiEvent {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  organizer: string;
  contact: string;
  status: ApiEventStatus;
  registrationOpen: boolean;
  publicToken: string;
  createdAt: string;
  preRegistered: number;
  arrived: number;
  eligibleDonors: number;
  donations: number;
  bloodUnits: number;
}

export type ApiAttendance = "Pre-registered" | "Arrived" | "Did Not Arrive";
export type ApiOutcome = "—" | "Donated" | "Did Not Donate" | "Deferred";

export interface ApiPreReg {
  id: string;
  eventId: string;
  eventName: string;
  name: string;
  dob: string | null;
  sex: string | null;
  contact: string;
  email: string;
  address: string;
  bloodType: string | null;
  registeredAt: string;
  date: string;
  attendance: ApiAttendance;
  outcome: ApiOutcome;
  donorId: string | null;
  donationId: string | null;
  verifiedAt: string | null;
}

export interface ApiDonor {
  id: string;
  name: string;
  dob: string;
  sex: "Male" | "Female";
  bloodType: string;
  contact: string;
  email: string;
  address: string;
  status: "Active" | "Deferred" | "Inactive";
  registrationDate: string;
  totalDonations: number;
  lastDonation: string | null;
}

export interface ApiDonorDonation {
  id: string;
  date: string;
  bloodType: string;
  status: string;
  notes: string;
  eventId: string | null;
  eventName: string | null;
  bloodUnitId: string | null;
  component: string | null;
  unitStatus: string | null;
}

export interface ApiUnitSummary {
  id: string;
  component: string;
  status: string;
  testingStatus: string;
  expirationDate: string;
  storageLocation: string;
}

export interface ApiDonation {
  id: string;
  donorId: string;
  donorName: string;
  eventId: string | null;
  eventName: string | null;
  preRegId: string | null;
  date: string;
  bloodType: string;
  status: "Completed" | "Deferred" | "Cancelled";
  personnel: string;
  notes: string;
  bloodUnitId: string | null;
  bloodUnit: ApiUnitSummary | null;
  createdAt: string;
}

export interface ApiPublicEvent {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  organizer: string;
  contact: string;
  status: ApiEventStatus;
  acceptingRegistrations: boolean;
}

export interface ApiTestRecord {
  id: number;
  unitId: string;
  testingDate: string;
  screeningStatus: string;
  result: string;
  usabilityStatus: string;
  testedBy: string | null;
  tests: { name: string; result: string; passed: boolean }[];
  createdAt: string;
}

export interface ApiUnit {
  id: string;
  donationId: string;
  donorId: string;
  donorName: string;
  eventId: string | null;
  eventName: string | null;
  bloodType: string;
  component: string;
  collectionDate: string;
  expirationDate: string;
  daysToExpiry: number;
  status: string;
  testingStatus: string;
  storageLocation: string;
  shelf: string;
  position: string;
  lastActivity: string | null;
  lastActivityNote: string;
  lastActivityAction: string;
}

export interface ApiUnitDetail {
  unit: ApiUnit;
  donation: { id: string; date: string; status: string; personnel: string; notes: string };
  testRecords: ApiTestRecord[];
  history: { id: number; action: string; note: string; occurredAt: string; performedBy: string | null }[];
}

export interface ApiTestListItem {
  id: number;
  unitId: string;
  donationId: string;
  donorName: string;
  bloodType: string;
  testingDate: string;
  screeningStatus: string;
  result: string;
  usabilityStatus: string;
  testedBy: string | null;
  tests: { name: string; result: string; passed: boolean }[];
}

export interface ApiInventorySummary {
  asOf: string;
  expiringSoonDays: number;
  byBloodType: {
    bloodType: string;
    usable: number;
    quarantined: number;
    notUsable: number;
    pendingTesting: number;
    expired: number;
    issued?: number;
    expiringSoon: number;
    lowStockThreshold: number;
    isLowStock: boolean;
  }[];
  totals: { usable: number; quarantined: number; notUsable: number; pendingTesting: number; expired: number; expiringSoon: number };
  byComponent: { component: string; usable: number }[];
}

export type ApiRange = "last-3-months" | "last-6-months" | "this-year";

export interface ApiOverview {
  period: { range: ApiRange; label: string; from: string; to: string };
  kpis: {
    totalDonors: number;
    donationsThisMonth: number;
    donationsLastMonthSameDays: number;
    donationsChangePercent: number | null;
    usableUnits: number;
    expiringSoonUnits: number;
    quarantinedUnits: number;
    notUsableUnits: number;
    pendingTestingUnits: number;
    expiredUnitsThisMonth: number;
    upcomingEvents: number;
    nextEventDate: string | null;
  };
  donationTrends: { key: string; month: string; year: number; donations: number; units: number }[];
  trend: { current: number; previous: number; changePercent: number | null; comparedWith: string };
  unitStatus: { name: string; value: number; percent: number }[];
  usabilityRates: { name: string; value: number; percent: number }[];
  testingOutcomes: { name: string; value: number }[];
  inventoryByBloodType: { type: string; units: number }[];
  eventPerformance: { id: string; name: string; date: string; preRegistered: number; arrived: number; donations: number; bloodUnits: number }[];
}

export interface ApiDashboard {
  role: Role;
  upcomingEvents: { count: number; nextDate: string | null };
  system?: { totalUsers: number; activeUsers: number; inactiveUsers: number; admins: number; medTechs: number };
  kpis?: ApiOverview["kpis"];
  inventory?: ApiInventorySummary;
  donationTrends?: ApiOverview["donationTrends"];
  unitStatus?: ApiOverview["unitStatus"];
}
