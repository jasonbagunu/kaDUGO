import type { Role } from "../data/mock";

// The signed-in user and their login token. Kept in sessionStorage, so it is
// cleared when the browser tab is closed. The token is what the backend
// checks on every request; the name/role here only decide what the screens show.
const SESSION_KEY = "kadugo_session";
const NOTICE_KEY = "kadugo_notice";
export const SESSION_EVENT = "kadugo-session-changed";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  token: string;
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    // A session saved by an older version has no token: treat it as signed out.
    if (!s.token || !s.userId || !s.role) return null;
    return s as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  sessionStorage.removeItem(NOTICE_KEY); // a fresh sign-in clears any old "session expired" message
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT)); // lets the sidebar refresh the name/role
}

// Signing out by hand also clears any leftover message. (The expired-session
// path calls this first, then sets its message.)
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(NOTICE_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function isAuthenticated() {
  return getSession() !== null;
}

// A one-time message to show on the login page (for example "session expired").
export function setNotice(message: string) {
  sessionStorage.setItem(NOTICE_KEY, message);
}

// Read the message without removing it: the login page can be shown twice in a
// row (once inside the app, once after a full reload), and both must show it.
// It is cleared by the next successful sign-in or sign-out.
export function peekNotice(): string | null {
  return sessionStorage.getItem(NOTICE_KEY);
}
