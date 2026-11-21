import { Navigate, Outlet } from "react-router";
import type { Role } from "../data/mock";

import { useEffect } from "react";
import { api } from "../lib/api";
import { getSession, isAuthenticated, setSession } from "../lib/session";

// The session itself (who is signed in, and their token) lives in lib/session.
// Re-exported so existing imports from this file keep working.
export { clearSession, getSession, isAuthenticated, setSession } from "../lib/session";
export type { Session } from "../lib/session";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEDTECH: "MedTech",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Gate for any authenticated session, regardless of role. */
export default function RequireAuth() {
  // Ask the server who we are each time the app opens: the name or role may
  // have been changed by an administrator since this tab last signed in.
  useEffect(() => {
    if (!isAuthenticated()) return;
    api<{ user: { name: string; email: string; role: Role } }>("/auth/me")
      .then(({ user }) => {
        const s = getSession();
        if (!s) return;
        if (s.role !== user.role) {
          // Permissions changed: restart on the dashboard with the new role.
          setSession({ ...s, name: user.name, email: user.email, role: user.role });
          window.location.assign("/");
        } else if (s.name !== user.name || s.email !== user.email) {
          setSession({ ...s, name: user.name, email: user.email });
        }
      })
      .catch(() => {
        // An expired session is handled inside api(); other errors can wait.
      });
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/**
 * Gate for a specific set of roles. Renders the matched child routes when
 * the current session's role is in `allow`; otherwise redirects to
 * /access-denied. This is real route protection (checked on every route
 * entry), not just a hidden sidebar link.
 */
function RequireRole({ allow }: { allow: Role[] }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (!allow.includes(session.role)) return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}

// Pre-bound guards for use directly as route `Component` values (routes.ts
// has no JSX, so these wrap RequireRole with a fixed allow-list).
export function RequireAnyRole() {
  return <RequireRole allow={["SUPER_ADMIN", "ADMIN", "MEDTECH"]} />;
}

export function RequireAdminOrAbove() {
  return <RequireRole allow={["SUPER_ADMIN", "ADMIN"]} />;
}

// Admin and MedTech only — the two operational/medical-record roles.
// Super Admin is deliberately excluded here: they're system/IT
// administration, not blood-bank staff, so they shouldn't manage donor,
// donation, testing, blood unit, inventory, or analytics data.
export function RequireOperationalStaff() {
  return <RequireRole allow={["ADMIN", "MEDTECH"]} />;
}

export function RequireSuperAdmin() {
  return <RequireRole allow={["SUPER_ADMIN"]} />;
}
