import { useState } from "react";
import { Lock } from "lucide-react";
import { PageHeader, PrimaryButton, FormField, TextInput, Toast } from "../components/ui";
import PasswordChecklist, { isStrongPassword } from "../components/PasswordChecklist";
import { useData } from "../context/DataContext";
import { getSession, roleLabel } from "../components/RequireAuth";
import { setSession } from "../lib/session";
import { api, errorMessage } from "../lib/api";

// "My Profile": opened from the profile icon. Every role (Super Admin, Admin,
// MedTech) sees their own account here and can edit name/email and password.
export default function Profile() {
  const { toast, showToast } = useData();
  const session = getSession();
  const [form, setForm] = useState({ name: session?.name ?? "", email: session?.email ?? "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { user } = await api<{ user: { name: string; email: string } }>("/auth/me", {
        method: "PATCH",
        body: { name: form.name, email: form.email },
      });
      const cur = getSession();
      if (cur) setSession({ ...cur, name: user.name, email: user.email });
      setForm({ name: user.name, email: user.email });
      showToast("Profile updated.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.current || !pw.next || !pw.confirm) return showToast("Please fill in all password fields.", "error");
    if (!isStrongPassword(pw.next)) return showToast("New password does not meet all the requirements.", "error");
    if (pw.next !== pw.confirm) return showToast("New password and confirmation do not match.", "error");
    setSavingPw(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { currentPassword: pw.current, newPassword: pw.next } });
      showToast("Password updated.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setPw({ current: "", next: "", confirm: "" }); // always cleared
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader title="My Profile" subtitle="Your account information" />

      <section className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[#7C2D3E] text-white flex items-center justify-center text-lg font-bold">
            {(session?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-[#1C1C2E]" data-testid="profile-name">{session?.name}</div>
            <div className="text-sm text-[#6B7280]">{session ? roleLabel(session.role) : ""} • Cagayan Valley Regional Blood Center</div>
          </div>
        </div>
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4" autoComplete="off">
          <FormField label="Full name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /></FormField>
          <FormField label="Email" required><TextInput type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required /></FormField>
          <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save changes"}</PrimaryButton></div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <h2 className="flex items-center gap-2 font-semibold text-[#1C1C2E] mb-4"><Lock className="w-4 h-4" /> Change password</h2>
        <form onSubmit={savePassword} className="grid sm:grid-cols-2 gap-4" autoComplete="off">
          <div className="sm:col-span-2"><FormField label="Current password" required>
            <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="w-full px-3 py-2.5 border border-[#E8E5E2] rounded-lg text-sm" />
          </FormField></div>
          <FormField label="New password" required>
            <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="w-full px-3 py-2.5 border border-[#E8E5E2] rounded-lg text-sm" />
          </FormField>
          <FormField label="Confirm new password" required>
            <input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="w-full px-3 py-2.5 border border-[#E8E5E2] rounded-lg text-sm" />
          </FormField>
          <div className="sm:col-span-2"><PasswordChecklist password={pw.next} /></div>
          <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={savingPw}>{savingPw ? "Updating..." : "Update password"}</PrimaryButton></div>
        </form>
      </section>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
