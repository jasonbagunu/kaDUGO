import { useSearchParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SecondaryButton, SearchInput, Select, Table, Td,
  Modal, FormField, TextInput, SelectInput, Toast,
} from "../components/ui";
import Pagination from "../components/Pagination";
import PasswordChecklist, { isStrongPassword } from "../components/PasswordChecklist";
import { useApi, useDebounced } from "../lib/useApi";
import { useData } from "../context/DataContext"; // only for the shared toast message
import type { Role } from "../data/mock";
import { getSession, roleLabel } from "../components/RequireAuth";
import { api, ApiUser, errorMessage } from "../lib/api";

interface UsersPage { users: ApiUser[]; total: number; page: number; pageSize: number; activeCount: number; inactiveCount: number }

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

  // Search, filters and pages are handled by the server, so only one page of accounts is loaded at a time.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? ""); // quick search links arrive with ?search=
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useDebounced(search.trim(), 300);
  useEffect(() => { setPage(1); }, [q, roleFilter, statusFilter, pageSize]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("search", q);
  if (roleFilter) params.set("role", roleFilter);
  if (statusFilter) params.set("status", statusFilter);
  const list = useApi<UsersPage>(`/users?${params.toString()}`);
  const visibleUsers = list.data?.users ?? [];
  const total = list.data?.total ?? 0;
  const loading = list.loading && !list.data;
  const loadError = list.error;
  const loadUsers = list.reload;

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Changes each time the form opens, so the inputs are brand new (nothing carried over, nothing autofilled).
  const [formKey, setFormKey] = useState(0);
  const [taken, setTaken] = useState({ username: false, email: false });

  // Warns while typing when the username or email already belongs to another account.
  const dUsername = useDebounced(form.username.trim(), 400);
  const dEmail = useDebounced(form.email.trim(), 400);
  const checkSeq = useRef(0);
  useEffect(() => {
    if (!modalOpen) return;
    const seq = ++checkSeq.current;
    if (dUsername.length < 3 && !dEmail.includes("@")) { setTaken({ username: false, email: false }); return; }
    const qs = new URLSearchParams();
    if (dUsername.length >= 3) qs.set("username", dUsername);
    if (dEmail.includes("@")) qs.set("email", dEmail);
    if (editTarget) qs.set("excludeId", editTarget.id);
    api<{ usernameTaken: boolean; emailTaken: boolean }>(`/users/availability?${qs.toString()}`)
      .then((r) => { if (seq === checkSeq.current) setTaken({ username: r.usernameTaken, email: r.emailTaken }); })
      .catch(() => { /* the server still checks when saving */ });
  }, [dUsername, dEmail, modalOpen, editTarget]);

  const set = (k: keyof UserForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const resetForm = (next: UserForm) => { setForm(next); setFormError(""); setTaken({ username: false, email: false }); setFormKey((k) => k + 1); };
  const openAdd = () => { setEditTarget(null); resetForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: ApiUser) => {
    setEditTarget(u);
    resetForm({ name: u.name, username: u.username, email: u.email, password: "", confirmPassword: "", role: u.role });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); resetForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role) return;
    setFormError("");

    // New accounts need a password. When editing, leaving it blank keeps the
    // current one; typing a new one replaces it.
    const wantsPassword = !editTarget || form.password !== "" || form.confirmPassword !== "";
    const clearPasswords = () => setForm((f) => ({ ...f, password: "", confirmPassword: "" }));
    if (taken.username || taken.email) {
      setFormError(taken.username ? "That username is already taken." : "That email is already used by another account.");
      return;
    }
    if (wantsPassword) {
      if (!isStrongPassword(form.password)) {
        setFormError("Password does not meet all the requirements listed below.");
        clearPasswords();
        return;
      }
      if (form.password !== form.confirmPassword) {
        setFormError("Password and confirmation do not match.");
        clearPasswords();
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
        setPage(1);
        await loadUsers();
        showToast(`Account created for "${form.name}". They can sign in with username "${form.username.trim().toLowerCase()}".`);
      }
      // Success: close and wipe every field (including the password) so nothing is left for the next account.
      closeModal();
    } catch (err) {
      // Failure: keep what was typed so it can be corrected, but never keep the passwords.
      setFormError(errorMessage(err));
      clearPasswords();
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
          <span className="text-xs text-[#6B7280]">{total} accounts</span>
        </div>

        <div className="p-4 border-b border-[#E8E5E2] flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, username, email..." />
          {manageableRoles.length > 1 && (
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[{ label: "All Roles", value: "" }, ...roleOpts]}
            />
          )}
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ label: "All Status", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }]}
          />
          {(search || roleFilter || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); }}
              className="text-xs text-[#7C2D3E] underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
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
            <button onClick={() => void loadUsers()} className="underline cursor-pointer">Try again</button>
          </div>
        )}
        {!loading && !loadError && visibleUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B7280]">
            {search || roleFilter || statusFilter ? "No accounts match your search or filters." : "No accounts in your management scope yet."}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? `Edit User — ${editTarget.name}` : "Add New User"}
        size="sm"
      >
        <form key={formKey} onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
          <FormField label="Full Name" required>
            <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Dr. Jose Villanueva" required />
          </FormField>
          <FormField label="Username" required>
            <input
              type="text"
              name="new-account-username"
              autoComplete="off"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="e.g. jvillanueva"
              required
              className={`w-full border rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 placeholder:text-gray-400 ${taken.username ? "border-red-300 focus:ring-red-100" : "border-[#E8E5E2] focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"}`}
            />
            {taken.username && <p className="text-xs text-red-600 mt-1" data-testid="username-taken">This username is already taken.</p>}
          </FormField>
          <FormField label="Email Address" required>
            <input
              type="email"
              name="new-account-email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@cvrbc.doh.gov.ph"
              required
              className={`w-full border rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 placeholder:text-gray-400 ${taken.email ? "border-red-300 focus:ring-red-100" : "border-[#E8E5E2] focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"}`}
            />
            {taken.email && <p className="text-xs text-red-600 mt-1" data-testid="email-taken">This email is already used by another account.</p>}
          </FormField>
          <FormField label={editTarget ? "New Password" : "Password"} required={!editTarget}>
            <input
              type="password"
              name="new-account-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={editTarget ? "Leave blank to keep current password" : "Create a strong password"}
              required={!editTarget}
              className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400"
            />
            {(!editTarget || form.password) && <PasswordChecklist password={form.password} />}
          </FormField>
          <FormField label="Confirm Password" required={!editTarget}>
            <input
              type="password"
              name="new-account-confirm"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              placeholder="Re-enter the password"
              required={!editTarget}
              className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400"
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match yet.</p>
            )}
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
            <SecondaryButton onClick={closeModal}>Cancel</SecondaryButton>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
