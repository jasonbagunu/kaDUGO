import { createBrowserRouter, redirect } from "react-router";
import RequireAuth, { RequireAnyRole, RequireAdminOrAbove, RequireOperationalStaff, RequireSuperAdmin } from "./components/RequireAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Donors from "./pages/Donors";
import DonorProfile from "./pages/DonorProfile";
import Donations from "./pages/Donations";
import DonationDetail from "./pages/DonationDetail";
import BloodUnits from "./pages/BloodUnits";
import Traceability from "./pages/Traceability";
import Testing from "./pages/Testing";
import Inventory from "./pages/Inventory";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import PreRegistrations from "./pages/PreRegistrations";
import PublicRegistration from "./pages/PublicRegistration";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import AuditLogs from "./pages/AuditLogs";
import AccessDenied from "./pages/AccessDenied";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    // Public pre-registration never requires authentication — potential
    // donors are not system users and never get an account.
    path: "/register/:eventId",
    Component: PublicRegistration,
  },
  {
    // Everything below requires a session. Unauthenticated visits to any of
    // these paths (including "/") redirect to /login first.
    Component: RequireAuth,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          // Reachable by any authenticated role — the page itself decides
          // what to say based on which role got redirected here.
          { path: "access-denied", Component: AccessDenied },

          // SUPER_ADMIN, ADMIN, and MEDTECH — shared overview/scheduling
          // pages. Dashboard, Events, and Pre-Registrations stay reachable by
          // Super Admin (system overview + donation-drive scheduling), even
          // though they're excluded from the medical/operational modules below.
          {
            Component: RequireAnyRole,
            children: [
              { index: true, Component: Dashboard },
              { path: "events", Component: Events },
              { path: "events/create", loader: () => redirect("/events?create=1") },
              { path: "events/:id", Component: EventDetail },
              { path: "pre-registrations", Component: PreRegistrations },
              { path: "profile", Component: Profile },
            ],
          },

          // ADMIN and MEDTECH only — medical/operational record-keeping.
          // Super Admin is deliberately excluded: they're system/IT
          // administration, not blood-bank staff, so they don't interfere
          // with donor, donation, testing, blood unit, inventory, or
          // analytics data.
          {
            Component: RequireOperationalStaff,
            children: [
              { path: "donors", Component: Donors },
              { path: "donors/:id", Component: DonorProfile },
              { path: "donations", Component: Donations },
              { path: "donations/:id", Component: DonationDetail },
              { path: "blood-units", Component: BloodUnits },
              { path: "blood-units/:id", Component: Traceability },
              { path: "testing", Component: Testing },
              { path: "inventory", Component: Inventory },
              { path: "analytics", Component: Analytics },
            ],
          },

          // SUPER_ADMIN and ADMIN — Admin can manage MedTech accounts only;
          // Super Admin can manage both Admin and MedTech accounts.
          // Users.tsx itself scopes what each role sees/can do there.
          {
            Component: RequireAdminOrAbove,
            children: [
              { path: "users", Component: Users },
            ],
          },

          // SUPER_ADMIN only — system configuration, audit trail, and backup/restore.
          {
            Component: RequireSuperAdmin,
            children: [
              { path: "settings", Component: Settings },
              { path: "audit-logs", Component: AuditLogs },
            ],
          },
        ],
      },
    ],
  },
]);
