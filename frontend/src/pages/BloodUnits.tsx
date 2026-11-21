import { useState } from "react";
import { Link } from "react-router";
import { Eye, Pencil, Activity } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SecondaryButton, SearchInput, Select, Table, Td,
  Modal, Toast, FormField, TextInput, SelectInput,
} from "../components/ui";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiUnit, type Paged } from "../lib/api";
import { useApi, useDebounced } from "../lib/useApi";

const BT_OPTS = [
  { label: "Select blood type", value: "" },
  ...["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => ({ label: b, value: b })),
];
const BT_FILTER = [{ label: "All Blood Types", value: "" }, ...BT_OPTS.slice(1)];

const COMPONENT_OPTS = [
  { label: "Select component", value: "" },
  { label: "Whole Blood", value: "Whole Blood" },
  { label: "Packed RBC", value: "Packed RBC" },
  { label: "Fresh Frozen Plasma", value: "Fresh Frozen Plasma" },
  { label: "Platelet Concentrate", value: "Platelet Concentrate" },
];
const COMPONENT_FILTER = [{ label: "All Components", value: "" }, ...COMPONENT_OPTS.slice(1)];

const STATUS_FILTER = [
  { label: "All Status", value: "" },
  { label: "Pending Testing", value: "Pending Testing" },
  { label: "Usable", value: "Usable" },
  { label: "Quarantined", value: "Quarantined" },
  { label: "Not Usable", value: "Not Usable" },
  { label: "Expired", value: "Expired" },
  { label: "Issued", value: "Issued" },
];

const EDITABLE_STATUS = ["Quarantined", "Not Usable", "Usable"];

export default function BloodUnits() {
  const { toast, showToast } = useData();

  const [search, setSearch] = useState("");
  const [bt, setBt] = useState("");
  const [component, setComponent] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ pageSize: "500", sort: "recent" });
  if (q) params.set("search", q);
  if (bt) params.set("bloodType", bt);
  if (component) params.set("component", component);
  if (status) params.set("status", status);
  const list = useApi<Paged<ApiUnit>>(`/blood-units?${params.toString()}`);
  const everything = useApi<Paged<ApiUnit>>("/blood-units?pageSize=500");
  const filtered = list.data?.items ?? [];
  const allUnits = everything.data?.items ?? [];

  const [editTarget, setEditTarget] = useState<ApiUnit | null>(null);
  const [ef, setEf] = useState({ storageLocation: "", shelf: "", position: "", status: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = async () => { await Promise.all([list.reload(), everything.reload()]); };

  const openEdit = (u: ApiUnit) => {
    setEf({ storageLocation: u.storageLocation, shelf: u.shelf, position: u.position, status: u.status, reason: "" });
    setFormError("");
    setEditTarget(u);
  };

  const final = editTarget ? editTarget.status === "Not Usable" || editTarget.status === "Expired" || editTarget.status === "Issued" : false;
  const canMakeUsable = !!editTarget && editTarget.status === "Quarantined" && (editTarget.testingStatus === "Passed" || editTarget.testingStatus === "Completed");
  const statusOpts = [
    ...(editTarget && !EDITABLE_STATUS.includes(editTarget.status) ? [{ label: `${editTarget.status} (current)`, value: editTarget.status }] : []),
    { label: "Quarantined", value: "Quarantined" },
    { label: "Not Usable", value: "Not Usable" },
    ...(canMakeUsable || editTarget?.status === "Usable" ? [{ label: "Usable", value: "Usable" }] : []),
  ];

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setFormError("");
    try {
      const storageChanged = ef.storageLocation !== editTarget.storageLocation || ef.shelf !== editTarget.shelf || ef.position !== editTarget.position;
      const statusChanged = !final && ef.status !== editTarget.status;
      if (statusChanged && ef.reason.trim().length < 3) {
        setFormError("Give a reason for the status change.");
        setSaving(false);
        return;
      }
      if (storageChanged) {
        await api(`/blood-units/${editTarget.id}/storage`, {
          method: "PATCH",
          body: { storageLocation: ef.storageLocation, shelf: ef.shelf, position: ef.position },
        });
      }
      if (statusChanged) {
        await api(`/blood-units/${editTarget.id}/status`, { method: "PATCH", body: { status: ef.status, reason: ef.reason } });
      }
      setEditTarget(null);
      await refresh();
      showToast(storageChanged || statusChanged ? "Blood unit updated successfully." : "No changes to save.");
    } catch (err) {
      setFormError(errorMessage(err));
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Blood Units"
        subtitle="Units are created automatically when a donation is recorded — track, store and classify them here"
      />

      {/* Summary */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {(["Pending Testing", "Usable", "Quarantined", "Not Usable", "Expired", "Issued"] as const).map((s) => {
          const count = allUnits.filter((u) => u.status === s).length;
          const styles: Record<string, string> = {
            "Pending Testing": "text-gray-600 bg-gray-50 border-gray-200",
            Usable: "text-green-700 bg-green-50 border-green-200",
            Quarantined: "text-amber-700 bg-amber-50 border-amber-200",
            "Not Usable": "text-red-700 bg-red-50 border-red-200",
            Expired: "text-gray-500 bg-gray-50 border-gray-200",
            Issued: "text-blue-700 bg-blue-50 border-blue-200",
          };
          return (
            <div key={s} className={`rounded-xl border p-3 flex items-center gap-3 ${styles[s]}`}>
              <div className="text-2xl font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>{count}</div>
              <div className="text-xs font-medium">{s}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search unit ID, donor, donation..." />
          <Select value={bt} onChange={setBt} options={BT_FILTER} />
          <Select value={component} onChange={setComponent} options={COMPONENT_FILTER} />
          <Select value={status} onChange={setStatus} options={STATUS_FILTER} />
          <span className="text-xs text-[#6B7280] ml-auto">{list.data?.total ?? 0} results</span>
        </div>

        <Table headers={["Blood Unit ID", "Donation ID", "Donor", "Blood Type", "Component", "Testing", "Status", "Collection Date", "Actions"]}>
          {filtered.map((u) => (
            <tr key={u.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td>
                <Link to={`/blood-units/${u.id}`} className="text-[#7C2D3E] font-medium hover:underline text-xs font-mono flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {u.id}
                </Link>
              </Td>
              <Td>
                <Link to={`/donations/${u.donationId}`} className="text-xs font-mono text-[#7C2D3E] hover:underline">{u.donationId}</Link>
              </Td>
              <Td>
                <Link to={`/donors/${u.donorId}`} className="text-sm text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline font-medium">{u.donorName}</Link>
              </Td>
              <Td>
                <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{u.bloodType}</span>
              </Td>
              <Td><span className="text-sm text-[#6B7280]">{u.component}</span></Td>
              <Td><Badge status={u.testingStatus} /></Td>
              <Td><Badge status={u.status} /></Td>
              <Td><span className="text-sm text-[#6B7280]">{u.collectionDate}</span></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Link to={`/blood-units/${u.id}`} className="p-1.5 rounded-lg hover:bg-[#FDF2F4] text-[#6B7280] hover:text-[#7C2D3E] transition-colors inline-flex" title="Traceability">
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-[#FDF2F4] text-[#6B7280] hover:text-[#7C2D3E] transition-colors cursor-pointer" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>

        {list.loading && !list.data && <div className="py-12 text-center text-sm text-[#6B7280]">Loading blood units...</div>}
        {list.error && (
          <div className="m-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <span>{list.error}</span>
            <button onClick={() => void list.reload()} className="font-medium underline cursor-pointer">Try again</button>
          </div>
        )}
        {list.data && filtered.length === 0 && (
          <div className="py-16 text-center text-[#6B7280]">
            <div className="text-4xl mb-2">🔍</div>
            <p className="font-medium">No blood units found</p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#E8E5E2] flex items-center justify-between text-xs text-[#6B7280]">
          <span>Showing {filtered.length} of {list.data?.total ?? 0} units</span>
        </div>
      </div>

      {/* Edit Blood Unit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Update Blood Unit — ${editTarget?.id ?? ""}`} size="md">
        {editTarget && (
          <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4">
            {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-[#F9F8F7] rounded-xl border border-[#E8E5E2] p-3 text-xs mb-1">
              <div><span className="text-[#9CA3AF] uppercase tracking-wide font-semibold">Donor</span><div className="text-[#1C1C2E] font-medium mt-0.5">{editTarget.donorName}</div></div>
              <div><span className="text-[#9CA3AF] uppercase tracking-wide font-semibold">Blood Type</span><div className="text-[#7C2D3E] font-bold mt-0.5">{editTarget.bloodType}</div></div>
              <div><span className="text-[#9CA3AF] uppercase tracking-wide font-semibold">Component</span><div className="text-[#1C1C2E] mt-0.5">{editTarget.component}</div></div>
              <div><span className="text-[#9CA3AF] uppercase tracking-wide font-semibold">Expires</span><div className="text-[#1C1C2E] mt-0.5">{editTarget.expirationDate}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormField label="Storage Location">
                  <TextInput value={ef.storageLocation} onChange={(v) => setEf((f) => ({ ...f, storageLocation: v }))} placeholder="e.g. Refrigerator A-01" required />
                </FormField>
              </div>
              <FormField label="Shelf">
                <TextInput value={ef.shelf} onChange={(v) => setEf((f) => ({ ...f, shelf: v }))} placeholder="e.g. 3" required />
              </FormField>
              <FormField label="Position">
                <TextInput value={ef.position} onChange={(v) => setEf((f) => ({ ...f, position: v }))} placeholder="e.g. 12" required />
              </FormField>
              <div className="col-span-2">
                <FormField label="Status" hint={final ? `${editTarget.status} is final and cannot be changed.` : "A unit becomes Usable only through passed test results. Use this to quarantine or discard a unit."}>
                  <SelectInput value={ef.status} onChange={(v) => setEf((f) => ({ ...f, status: v }))} options={statusOpts} disabled={final} />
                </FormField>
              </div>
              {!final && ef.status !== editTarget.status && (
                <div className="col-span-2">
                  <FormField label="Reason for status change" required>
                    <TextInput value={ef.reason} onChange={(v) => setEf((f) => ({ ...f, reason: v }))} placeholder="e.g. Bag leak found during inspection" required />
                  </FormField>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
              <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</PrimaryButton>
              <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            </div>
          </form>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
