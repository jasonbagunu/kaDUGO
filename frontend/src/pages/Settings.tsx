import { useRef, useState } from "react";
import { User, Lock, Bell, Settings as SettingsIcon, Package, ShieldCheck, DatabaseBackup, Download, Upload } from "lucide-react";
import { PageHeader, PrimaryButton, SecondaryButton, Toast } from "../components/ui";
import { useData } from "../context/DataContext";
import { getSession, roleLabel } from "../components/RequireAuth";
import { setSession } from "../lib/session";
import { api, errorMessage } from "../lib/api";
import { isStrongPassword } from "../components/PasswordChecklist";

const sections = [
  { key: "account", label: "Account Settings", icon: User },
  { key: "security", label: "Password & Security", icon: Lock },
  { key: "notifications", label: "Notification Preferences", icon: Bell },
  { key: "system", label: "System Preferences", icon: SettingsIcon },
  { key: "inventory", label: "Blood Inventory Settings", icon: Package },
  { key: "access", label: "User Access", icon: ShieldCheck },
  { key: "backup", label: "Backup & Restore", icon: DatabaseBackup },
];

export default function Settings() {
  const { toast, showToast } = useData();
  const session = getSession();

  const [active, setActive] = useState("account");
  const [profile, setProfile] = useState({
    name: session?.name ?? "Unknown User",
    email: session?.email ?? "",
    role: session ? roleLabel(session.role) : "",
    facility: "Cagayan Valley Regional Blood Center",
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Name and email are saved on the server. The username and role can only be
  // changed by the administrator who manages this account.
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { user } = await api<{ user: { name: string; email: string } }>("/auth/me", {
        method: "PATCH",
        body: { name: profile.name, email: profile.email },
      });
      const current = getSession();
      if (current) setSession({ ...current, name: user.name, email: user.email });
      setProfile((p) => ({ ...p, name: user.name, email: user.email }));
      showToast("Profile changes saved successfully.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoPick = () => photoInputRef.current?.click();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      showToast("Photo preview updated. Photos are not saved to the server yet.", "warning");
    };
    reader.readAsDataURL(file);
  };

  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Downloads a real copy of the database from the server.
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = await api<unknown>("/backup/export");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kaDUGO-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Backup exported and downloaded. Store the file securely: it contains confidential records.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreClick = () => restoreInputRef.current?.click();

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Restoring replaces every record in the database, so it is not enabled
    // from the browser. It needs a dedicated, confirmed restore procedure.
    showToast(`"${file.name}" was not restored. Restoring replaces all records and is not available from this screen yet.`, "warning");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      showToast("Please fill in all password fields.", "error");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      showToast("New password and confirmation do not match.", "error");
      return;
    }
    if (!isStrongPassword(pwForm.next)) {
      showToast("New password must have 8+ characters with uppercase, lowercase, a number and a special character.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword: pwForm.current, newPassword: pwForm.next },
      });
      setPwForm({ current: "", next: "", confirm: "" });
      showToast("Password updated successfully.");
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Manage your account and system preferences" />

      <div className="flex gap-5">
        {/* Sidebar nav */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-2 space-y-0.5">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer ${active === key ? "bg-[#FDF2F4] text-[#7C2D3E]" : "text-[#6B7280] hover:bg-gray-50 hover:text-[#1C1C2E]"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active === "account" && (
            <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
              <h3 className="font-bold text-[#1C1C2E] text-lg mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>Account Settings</h3>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#E8E5E2]">
                {photo ? (
                  <img src={photo} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-[#FDF2F4] rounded-full flex items-center justify-center text-[#7C2D3E] font-bold text-2xl">
                    {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[#1C1C2E]">{profile.name}</div>
                  <div className="text-sm text-[#6B7280]">{profile.role}</div>
                  <button type="button" onClick={handlePhotoPick} className="text-xs text-[#7C2D3E] hover:underline mt-1 cursor-pointer">Change photo</button>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Full Name", key: "name" },
                  { label: "Email Address", key: "email" },
                  { label: "Role", key: "role" },
                  { label: "Facility", key: "facility" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={profile[key as keyof typeof profile]}
                      onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                      disabled={key === "role" || key === "facility"}
                      className="w-full border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] disabled:bg-gray-50 disabled:text-[#6B7280]"
                    />
                  </div>
                ))}
                <div className="pt-4">
                  <PrimaryButton type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save Changes"}</PrimaryButton>
                </div>
              </div>
            </form>
          )}

          {active === "security" && (
            <form onSubmit={handleUpdatePassword} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
              <h3 className="font-bold text-[#1C1C2E] text-lg mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>Password & Security</h3>
              <div className="space-y-4">
                {[
                  { label: "Current Password", key: "current" as const },
                  { label: "New Password", key: "next" as const },
                  { label: "Confirm New Password", key: "confirm" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">{label}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={pwForm[key]}
                      onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"
                    />
                  </div>
                ))}
                <div className="pt-4">
                  <PrimaryButton type="submit" disabled={savingPassword}>{savingPassword ? "Updating…" : "Update Password"}</PrimaryButton>
                </div>
              </div>
            </form>
          )}

          {active === "notifications" && (
            <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
              <h3 className="font-bold text-[#1C1C2E] text-lg mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: "Low stock alerts", desc: "Notify when blood type inventory falls below threshold" },
                  { label: "Expiring units", desc: "Notify 7 days before blood units expire" },
                  { label: "Reactive test results", desc: "Immediate notification for reactive screening results" },
                  { label: "Upcoming events", desc: "Reminder 1 day before donation events" },
                  { label: "New donor registrations", desc: "Notify on new donor registration" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start justify-between py-3 border-b border-[#F3F0ED]">
                    <div>
                      <div className="text-sm font-medium text-[#1C1C2E]">{label}</div>
                      <div className="text-xs text-[#6B7280] mt-0.5">{desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="sr-only peer"
                        onChange={(e) => showToast(`"${label}" ${e.target.checked ? "enabled" : "disabled"}.`)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-[#7C2D3E] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "backup" && (
            <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
              <h3 className="font-bold text-[#1C1C2E] text-lg mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Backup & Restore</h3>
              <p className="text-sm text-[#6B7280] mb-6">Export a full snapshot of system data, or restore from a previous backup.</p>

              <div className="border border-[#E8E5E2] rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#1C1C2E]">Export Full Backup</div>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      Downloads a complete copy of the database (donors, donations, blood units, testing records, events,
                      pre-registrations, user accounts and the audit log) as one JSON file. It contains
                      confidential records and password hashes, so keep it secure.
                    </p>
                  </div>
                  <PrimaryButton onClick={handleExportBackup} disabled={exporting} className="flex-shrink-0">
                    <Download className="w-4 h-4" /> {exporting ? "Exporting…" : "Export Backup"}
                  </PrimaryButton>
                </div>
              </div>

              <div className="border border-[#E8E5E2] rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#1C1C2E]">Restore from Backup</div>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      Restoring replaces every record in the database, so it is not available from this screen yet.
                    </p>
                  </div>
                  <SecondaryButton onClick={handleRestoreClick} className="flex-shrink-0">
                    <Upload className="w-4 h-4" /> Choose File
                  </SecondaryButton>
                  <input ref={restoreInputRef} type="file" accept="application/json" onChange={handleRestoreFile} className="hidden" />
                </div>
              </div>
            </div>
          )}

          {(active === "system" || active === "inventory" || active === "access") && (
            <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
              <h3 className="font-bold text-[#1C1C2E] text-lg mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
                {sections.find((s) => s.key === active)?.label}
              </h3>
              <div className="py-12 text-center text-[#6B7280]">
                <SettingsIcon className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Configuration options coming soon</p>
                <p className="text-sm mt-1">This section is under development</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
