// Proof that the signed-in person re-entered their password a moment ago. It is kept
// in memory only (never stored), expires on its own, and is cleared on sign out.
let token: string | null = null;
let expiresAt = 0;

export function setReveal(newToken: string, seconds: number) {
  token = newToken;
  expiresAt = Date.now() + Math.max(0, seconds - 10) * 1000;
}

export function getRevealToken(): string | null {
  if (token && Date.now() < expiresAt) return token;
  token = null;
  return null;
}

export function clearReveal() {
  token = null;
  expiresAt = 0;
}
