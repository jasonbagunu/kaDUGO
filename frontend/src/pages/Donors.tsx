import { useState } from "react";
import { Link } from "react-router";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SearchInput, Select, Table, Td,
  Modal, ConfirmDialog, Toast, FormField, TextInput, SelectInput, SecondaryButton,
} from "../components/ui";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiDonor, type Paged } from "../lib/api";
import { getSession } from "../lib/session";
import { useApi, useDebounced } from "../lib/useApi";

type Donor = ApiDonor;

const BT_OPTS = [
  { label: "Select blood type", value: "" },
  ...["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => ({ label: b, value: b })),
];
const BT_FILTER_OPTS = [{ label: "All Blood Types", value: "" }, ...BT_OPTS.slice(1)];
const STATUS_OPTS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "Active" },
  { label: "Deferred", value: "Deferred" },
  { label: "Inactive", value: "Inactive" },
];
const DONOR_STATUS_OPTS = [
  { label: "Active", value: "Active" },
  { label: "Deferred", value: "Deferred" },
  { label: "Inactive", value: "Inactive" },
];

type DonorForm = {
  name: string; dob: string; sex: string; contact: string;
  email: string; address: string; bloodType: string; status: string;
};

const EMPTY_FORM: DonorForm = {
  name: "", dob: "", sex: "", contact: "", email: "", address: "", bloodType: "", status: "Active",
};

export default function Donors() {
  const { toast, showToast } = useData();
  const canDelete = getSession()?.role === "ADMIN"; // the server also enforces this

  const [search, setSearch] = useState("");
  const [bloodTypeFilter, setBloodTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const q = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ pageSize: "500" });
  if (q) params.set("search", q);
  if (bloodTypeFilter) params.set("bloodType", bloodTypeFilter);
  if (statusFilter) params.set("status", statusFilter);
  const list = useApi<Paged<ApiDonor>>(`/donors?${params.toString()}`);
  const donors = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Donor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Donor | null>(null);
  const [form, setForm] = useState<DonorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (k: keyof DonorForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(""); setModalOpen(true); };
  const openEdit = (d: Donor) => {
    setEditTarget(d);
    setForm({ name: d.name, dob: d.dob, sex: d.sex, contact: d.contact, email: d.email, address: d.address, bloodType: d.bloodType, status: d.status });
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bloodType || !form.sex) return;
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        await api(`/donors/${editTarget.id}`, { method: "PATCH", body: form });
        setModalOpen(false);
        await list.reload();
        showToast(`Donor "${form.name}" updated successfully.`);
      } else {
        const { donor } = await api<{ donor: ApiDonor }>("/donors", { method: "POST", body: form });
        setModalOpen(false);
        await list.reload();
        showToast(`Donor "${donor.name}" registered as ${donor.id}. To record a donation, use the Donations module.`);
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api(`/donors/${target.id}`, { method: "DELETE" });
      await list.reload();
      showToast(`Donor "${target.name}" removed.`, "warning");
    } catch (err) {
      showToast(errorMessage(err), "error");
    }
  };

  const filtered = donors;

  return (
    <div>
      <PageHeader
        title="Donors"
        subtitle={`${total} registered donors`}
        actions={
          <PrimaryButton onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Donor
          </PrimaryButton>
        }
      />

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search donor name, ID, contact..." />
          <Select value={bloodTypeFilter} onChange={setBloodTypeFilter} options={BT_FILTER_OPTS} />
          <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTS} />
          <span className="text-xs text-[#6B7280] ml-auto">{filtered.length} results</span>
        </div>

        <Table headers={["Donor ID", "Donor Name", "Blood Type", "Contact", "Last Donation", "Total Donations", "Status", "Actions"]}>
          {filtered.map((d) => (
            <tr key={d.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td><span className="text-xs font-mono text-[#6B7280]">{d.id}</span></Td>
              <Td>
                <div className="font-medium text-[#1C1C2E]">{d.name}</div>
                <div className="text-xs text-[#6B7280]">{d.email}</div>
              </Td>
              <Td>
                <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{d.bloodType}</span>
              </Td>
              <Td><span className="text-sm text-[#6B7280]">{d.contact}</span></Td>
              <Td><span className="text-sm text-[#6B7280]">{d.lastDonation ?? "—"}</span></Td>
              <Td>
                <span className="font-semibold text-[#1C1C2E]">{d.totalDonations}</span>
                <span className="text-xs text-[#6B7280] ml-1">donations</span>
              </Td>
              <Td><Badge status={d.status} /></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Link to={`/donors/${d.id}`} className="p-1.5 rounded-lg hover:bg-[#FDF2F4] text-[#6B7280] hover:text-[#7C2D3E] transition-colors" title="View Profile">
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#1C1C2E] transition-colors cursor-pointer" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        {list.loading && !list.data && <div className="py-12 text-center text-sm text-[#6B7280]">Loading donors...</div>}
        {list.error && (
          <div className="m-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <span>{list.error}</span>
            <button onClick={() => void list.reload()} className="font-medium underline cursor-pointer">Try again</button>
          </div>
        )}
        {list.data && filtered.length === 0 && (
          <div className="py-16 text-center text-[#6B7280]">
            <div className="text-4xl mb-2">🔍</div>
            <p className="font-medium">No donors found</p>
            <p className="text-sm">Try adjusting your search or filter criteria</p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#E8E5E2] flex items-center justify-between text-xs text-[#6B7280]">
          <span>Showing {filtered.length} of {total} donors</span>
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit Donor — ${editTarget.name}` : "Register New Donor"}
        size="lg"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
          {!editTarget && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <strong>Note:</strong> Adding a donor here registers them in the system. To record an actual donation (which creates the linked blood unit), use the <strong>Donations</strong> module or use <strong>Record Donation</strong> for an arrived pre-registrant in Event Details.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Full Name" required>
                <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Maria Luisa Santos" required />
              </FormField>
            </div>
            <FormField label="Date of Birth" required>
              <TextInput type="date" value={form.dob} onChange={(v) => set("dob", v)} required />
            </FormField>
            <FormField label="Sex" required>
              <SelectInput
                value={form.sex}
                onChange={(v) => set("sex", v)}
                options={[{ label: "Select sex", value: "" }, { label: "Male", value: "Male" }, { label: "Female", value: "Female" }]}
                required
              />
            </FormField>
            <FormField label="Contact Number" required>
              <TextInput value={form.contact} onChange={(v) => set("contact", v)} placeholder="09xxxxxxxxx" required />
            </FormField>
            <FormField label="Email Address">
              <TextInput type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="donor@email.com" />
            </FormField>
            <div className="col-span-2">
              <FormField label="Address" required>
                <TextInput value={form.address} onChange={(v) => set("address", v)} placeholder="City, Province" required />
              </FormField>
            </div>
            <FormField label="Blood Type" required>
              <SelectInput value={form.bloodType} onChange={(v) => set("bloodType", v)} options={BT_OPTS} required />
            </FormField>
            <FormField label="Status">
              <SelectInput value={form.status} onChange={(v) => set("status", v)} options={DONOR_STATUS_OPTS} />
            </FormField>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving..." : editTarget ? "Save Changes" : "Register Donor"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Remove Donor"
        message={`Remove "${deleteTarget?.name}" from the system? This cannot be undone. Donors who already have donation records cannot be removed; set them to Inactive instead.`}
        confirmLabel="Remove Donor"
        danger
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
