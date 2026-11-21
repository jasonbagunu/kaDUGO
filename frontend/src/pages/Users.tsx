import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SecondaryButton, Table, Td,
  Modal, FormField, TextInput, SelectInput, Toast,
} from "../components/ui";
import { useData } from "../context/DataContext"; // only for the shared toast message
import type { Role } from "../data/mock";
import { getSession, roleLabel } from "../components/RequireAuth";
import { api, ApiUser, errorMessage } from "../lib/api";

const roleColors: Record<Role, string> = {
  SUPER_ADMIN: "bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6]",
  ADMIN: "bg-blue-50 text-blue-700 border border-blue-200",
  MEDTECH: "bg-purple-50 text-purple-700 border border-purple-200",
};

const roleAccess: Record<Role, string[]> = {
  SUPER_ADMIN: ["Manage Admin & MedTech accounts", "System settings", "Backup & restore data", "Audit logs"],
  ADMIN: ["Donor & donation records", "Blood unit traceability", "Testing & screening", "Inventory", "Reports & analytics", "Manage MedTech accounts"],
  MEDTECH: ["Donor & donation records", "Blood unit traceability", "Testing & screening", "Inventory", "Reports & analytics"],
};

const ALL_ROLE_OPTS: { label: string; value: Role }[] = [
  { label: "Super Admin", value: "SUPER_ADMIN" },
  { label: "Admin", value: "ADMIN" },
  { label: "MedTech", value: "MEDTECH" },
];

type UserForm = { name: string; username: string; email: string; password: string; confirmPassword: string; role: Role | "" };

const MIN_PASSWORD_LENGTH = 8;

const formatLastLogin = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Never";

export default function Users() {
  const { toast, showToast } = useData();
  const session = getSession();
  const myRole = session?.role ?? "MEDTECH";

  // Admin can only manage MedTech accounts. Super Admin can manage Admin and
  // MedTech accounts. The server enforces this too; this just shapes the screen.
  const manageableRoles: Role[] = myRole === "SUPER_ADMIN" ? ["ADMIN", "MEDTECH"] : ["MEDTECH"];
  const roleOpts = ALL_ROLE_OPTS.filter((o) => manageableRoles.includes(o.value));
  const emptyForm: UserForm = { name: "", username: "", email: "", password: "", confirmPassword: "", role: manageableRoles.length === 1 ? manageableRoles[0] : "" };

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadError("");
    try {
      const data = await api<{ users: ApiUser[] }>("/users");
      setUsers(data.users);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const visibleUsers = users.filter((u) => manageableRoles.includes(u.role));

  const set = (k: keyof UserForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: ApiUser) => {
    setEditTarget(u);
    setForm({ name: u.name, username: u.username, email: u.email, password: "", confirmPassword: "", role: u.role });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role) return;

    // New accounts need a password. When editing, leaving it blank keeps the
    // current one; typing a new one replaces it.
    const wantsPassword = !editTarget || form.password !== "" || form.confirmPassword !== "";
    if (wantsPassword) {
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        showToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, "error");
        return;
      }
      if (form.password !== form.confirmPassword) {
        showToast("Password and confirmation do not match.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      if (editTarget) {
        await api(`/users/${editTarget.id}`, {
          method: "PATCH",
          body: {
            name: form.name,
            username: form.username,
            email: form.email,
            role: form.role,
            ...(wantsPassword ? { password: form.password } : {}),
          },
        });
        await loadUsers();
        showToast(wantsPassword ? `User "${form.name}" updated and password changed.` : `User "${form.name}" updated successfully.`);
      } else {
        await api("/users", {
          method: "POST",
          body: { name: form.name, username: form.username, email: form.email, password: form.password, role: form.role },
        });
        await loadUsers();
        showToast(`Account created for "${form.name}". They can sign in with username "${form.username.trim().toLowerCase()}".`);
      }
      setModalOpen(false);
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: ApiUser) => {
    const next = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api(`/users/${u.id}/status`, { method: "PATCH", body: { status: next } });
      await loadUsers(); // refresh the table first, so the message and the screen agree
      showToast(
        next === "INACTIVE" ? `"${u.name}" has been deactivated.` : `"${u.name}" has been activated.`,
        next === "INACTIVE" ? "warning" : "success"
      );
    } catch (err) {
      showToast(errorMessage(err), "error");
    }
  };

  const subtitle = myRole === "SUPER_ADMIN"
    ? "Manage Admin and MedTech accounts and role-based access"
    : "Manage MedTech accounts";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users & Access"
        subtitle={subtitle}
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add User
          </PrimaryButton>
        }
      />

      {/* Role legend: only roles this account can actually manage */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <h3 className="font-semibold text-[#1C1C2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
          {myRole === "SUPER_ADMIN" ? "Manageable Roles" : "Your Scope"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(roleAccess)
            .filter(([role]) => manageableRoles.includes(role as Role))
            .map(([role, access]) => (
              <div key={role} className="bg-[#F9F8F7] border border-[#E8E5E2] rounded-xl p-3">
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${roleColors[role as Role]}`}>{roleLabel(role as Role)}</div>
                <ul className="space-y-0.5">
                  {access.map((a) => (
                    <li key={a} className="text-[10px] text-[#6B7280] flex items-center gap-1">
                      <span className="w-1 h-1 bg-[#9CA3AF] rounded-full flex-shrink-0" />{a}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex items-center justify-between">
          <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {myRole === "SUPER_ADMIN" ? "Admin & MedTech Accounts" : "MedTech Accounts"}
          </h3>
          <span className="text-xs text-[#6B7280]">{visibleUsers.length} accounts</span>
        </div>

        <Table headers={["User", "Email", "Role", "Status", "Last Login", "Actions"]}>
          {visibleUsers.map((u) => (
            <tr key={u.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#FDF2F4] rounded-full flex items-center justify-center text-[#7C2D3E] font-bold text-xs flex-shrink-0">
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-[#1C1C2E] text-sm">{u.name}</div>
                    <div className="text-xs text-[#9CA3AF]">@{u.username}</div>
                  </div>
                </div>
              </Td>
              <Td><span className="text-xs text-[#6B7280]">{u.email}</span></Td>
              <Td>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[u.role]}`}>
                  {roleLabel(u.role)}
                </span>
              </Td>
              <Td><Badge status={u.status === "ACTIVE" ? "Active" : "Inactive"} /></Td>
              <Td><span className="text-xs text-[#6B7280]">{formatLastLogin(u.lastLoginAt)}</span></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#1C1C2E] transition-colors cursor-pointer" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {u.status === "ACTIVE"
                    ? <button onClick={() => handleToggle(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer" title="Deactivate"><ShieldAlert className="w-3.5 h-3.5" /></button>
                    : <button onClick={() => handleToggle(u)} className="p-1.5 rounded-lg hover:bg-green-50 text-[#6B7280] hover:text-green-600 transition-colors cursor-pointer" title="Activate"><ShieldCheck className="w-3.5 h-3.5" /></button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        {loading && <div className="py-12 text-center text-sm text-[#6B7280]">Loading accounts…</div>}
        {!loading && loadError && (
          <div className="py-12 text-center text-sm text-red-600">
            {loadError}{" "}
            <button onClick={() => { setLoading(true); loadUsers(); }} className="underline cursor-pointer">Try again</button>
          </div>
        )}
        {!loading && !loadError && visibleUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B7280]">No accounts in your management scope yet.</div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit User — ${editTarget.name}` : "Add New User"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required>
            <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Dr. Jose Villanueva" required />
          </FormField>
          <FormField label="Username" required>
            <TextInput value={form.username} onChange={(v) => set("username", v)} placeholder="e.g. jvillanueva" required />
          </FormField>
          <FormField label="Email Address" required>
            <TextInput type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="name@cvrbc.doh.gov.ph" required />
          </FormField>
          <FormField label={editTarget ? "New Password" : "Password"} required={!editTarget}>
            <TextInput
              type="password"
              value={form.password}
              onChange={(v) => set("password", v)}
              placeholder={editTarget ? "Leave blank to keep current password" : `At least ${MIN_PASSWORD_LENGTH} characters`}
              required={!editTarget}
            />
          </FormField>
          <FormField label="Confirm Password" required={!editTarget}>
            <TextInput
              type="password"
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              placeholder="Re-enter the password"
              required={!editTarget}
            />
          </FormField>
          <FormField label="Role" required>
            {roleOpts.length > 1 ? (
              <SelectInput value={form.role} onChange={(v) => set("role", v)} options={[{ label: "Select role", value: "" }, ...roleOpts]} required />
            ) : (
              <div className="w-full border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-[#6B7280]">
                {roleLabel(roleOpts[0].value)} <span className="text-[#9CA3AF]">(only role you can assign)</span>
              </div>
            )}
          </FormField>

          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add User"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
