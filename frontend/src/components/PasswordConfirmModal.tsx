import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Modal, PrimaryButton, SecondaryButton } from "./ui";
import { api, errorMessage } from "../lib/api";
import { setReveal } from "../lib/reveal";

// Asks the signed-in person for their password again before protected donor details
// are shown or changed. On success the app remembers it for a few minutes.
export default function PasswordConfirmModal({
  open, onClose, onConfirmed, reason = "view protected donor details",
}: { open: boolean; onClose: () => void; onConfirmed: () => void; reason?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Always start with an empty box: the password is never kept between openings.
  useEffect(() => {
    if (open) { setPassword(""); setError(""); setBusy(false); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError("Enter your password."); return; }
    setBusy(true);
    setError("");
    try {
      const { revealToken, expiresInSeconds } = await api<{ revealToken: string; expiresInSeconds: number }>(
        "/auth/reauth", { method: "POST", body: { password } },
      );
      setReveal(revealToken, expiresInSeconds);
      setPassword("");
      onConfirmed();
    } catch (err) {
      setError(errorMessage(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm your password" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-3 text-sm text-[#6B7280]">
          <div className="w-9 h-9 rounded-full bg-[#FDF2F4] flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-[#7C2D3E]" />
          </div>
          <p>For privacy, enter your password to {reason}. This access is recorded in the audit log.</p>
        </div>
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          aria-label="Your password"
          className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"
        />
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Checking…" : "Confirm"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
