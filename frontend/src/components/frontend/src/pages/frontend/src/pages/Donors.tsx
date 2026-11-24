import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Eye, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SearchInput, Select, Table, Td,
  Modal, ConfirmDialog, Toast, SecondaryButton,
} from "../components/ui";
import DonorFormFields, { EMPTY_DONOR_FORM, donorFormProblem, type DonorForm } from "../components/DonorFormFields";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import Pagination from "../components/Pagination";
import { useData } from "../context/DataContext";
import { ApiError, api, errorMessage, type ApiDonor, type ApiDonorSensitive, type ApiDuplicateDonor, type Paged } from "../lib/api";
import { getRevealToken } from "../lib/reveal";
import { getSession } from "../lib/session";
import { useApi, useDebounced } from "../lib/useApi";
import PreRegPicker from "../components/PreRegPicker";

type Donor = ApiDonor;

const BT_FILTER_OPTS = [
  { label: "All Blood Types", value: "" },
  ...["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => ({ label: b, value: b })),
];
const STATUS_OPTS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "Active" },
  { label: "Deferred", value: "Deferred" },
  { label: "Inactive", value: "Inactive" },
];
const SORT_OPTS = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Name A–Z", value: "name" },
];
const DONOR_STATUS_OPTS = [
  { label: "Active", value: "Active" },
  { label: "Deferred", value: "Deferred" },
  { label: "Inactive", value: "Inactive" },
];

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

export default function Donors() {
  const { toast, showToast } = useData();
  const canDelete = getSession()?.role === "ADMIN"; // the server also enforces this

  const [search, setSearch] = useState("");
  const [bloodTypeFilter, setBloodTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useDebounced(search.trim(), 300);

  // Any change to the search, filters or page size starts again from page 1.
  useEffect(() => { setPage(1); }, [q, bloodTypeFilter, statusFilter, sort, pageSize]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
  if (q) params.set("search", q);
  if (bloodTypeFilter) params.set("bloodType", bloodTypeFilter);
  if (statusFilter) params.set("status", statusFilter);
  const list = useApi<Paged<ApiDonor>>(`/donors?${params.toString()}`);
  const donors = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Donor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Donor | null>(null);
  const [form, setForm] = useState<DonorForm>(EMPTY_DONOR_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicates, setDuplicates] = useState<{ code: string; items: ApiDuplicateDonor[] } | null>(null);
  // Password confirmation (needed before protected details are shown or changed)
  const [askPassword, setAskPassword] = useState<null | (() => void)>(null);

  const set = <K extends keyof DonorForm>(k: K, v: DonorForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Add Donor has two ways in: type the details, or pick someone who pre-registered.
  const [addMode, setAddMode] = useState<"manual" | "prereg">("manual");

  const openAdd = () => {
    setAddMode("manual");
    setEditTarget(null); setForm(EMPTY_DONOR_FORM); setFormError(""); setDuplicates(null); setModalOpen(true);
  };

  // Loads the protected details of one donor into the edit form.
  const loadForEdit = async (d: Donor) => {
    try {
      const { sensitive } = await api<{ sensitive: ApiDonorSensitive }>(`/donors/${d.id}/sensitive`);
      const a = sensitive.addressDetails;
      setEditTarget(d);
      setForm({
        name: d.name, dob: sensitive.dob, sex: d.sex, contact: sensitive.contact, email: sensitive.email,
        address: {
          street: a?.street ?? "", regionCode: a?.region.code ?? "", provinceCode: a?.province.code ?? "",
          cityCode: a?.city.code ?? "", barangayCode: a?.barangay.code ?? "",
        },
        bloodType: d.bloodType, status: d.status, physicianCleared: false,
      });
      setFormError(
        a ? "" : "This record has an older, typed address. Please choose the address from the lists before saving.",
      );
      setDuplicates(null);
      setModalOpen(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") setAskPassword(() => () => void loadForEdit(d));
      else showToast(errorMessage(err), "error");
    }
  };

  const openEdit = (d: Donor) => {
    if (getRevealToken()) void loadForEdit(d);
    else setAskPassword(() => () => void loadForEdit(d));
  };

  const submit = async (confirmNotDuplicate = false) => {
    const problem = donorFormProblem(form);
    if (problem) { setFormError(problem); return; }
    setSaving(true);
    setFormError("");
    const body = {
      name: form.name.trim(), dob: form.dob, sex: form.sex, bloodType: form.bloodType, contact: form.contact,
      email: form.email.trim(), address: form.address, status: form.status,
      confirmAgeException: form.physicianCleared || undefined,
      confirmNotDuplicate: confirmNotDuplicate || undefined,
    };
    try {
      if (editTarget) {
        await api(`/donors/${editTarget.id}`, { method: "PATCH", body });
        showToast(`Donor "${form.name}" updated successfully.`);
      } else {
        const { donor } = await api<{ donor: ApiDonor }>("/donors", { method: "POST", body });
        showToast(`Donor "${donor.name}" registered as ${donor.id}. To record a donation, use the Donations module.`);
      }
      setModalOpen(false);
      setForm(EMPTY_DONOR_FORM);
      setDuplicates(null);
      await list.reload();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "POSSIBLE_DUPLICATE" || err.code === "DUPLICATE_DONOR")) {
        setDuplicates({ code: err.code, items: (err.data.duplicates as ApiDuplicateDonor[]) ?? [] });
        setFormError(err.message);
      } else if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        setAskPassword(() => () => void submit(confirmNotDuplicate));
      } else {
        setFormError(errorMessage(err));
      }
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
      if (donors.length === 1 && page > 1) setPage(page - 1);
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
          <Select value={sort} onChange={setSort} options={SORT_OPTS} />
          <span className="text-xs text-[#6B7280] ml-auto">{total} results</span>
        </div>

        <Table headers={["Donor ID", "Donor Name", "Blood Type", "Contact", "Last Donation", "Next Eligible", "Total Donations", "Status", "Actions"]}>
          {filtered.map((d) => (
            <tr key={d.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td><span className="text-xs font-mono text-[#6B7280]">{d.id}</span></Td>
              <Td>
                <div className="font-medium text-[#1C1C2E]">{d.name}</div>
                <div className="text-xs text-[#6B7280]">{d.age} yrs · {d.sex}</div>
              </Td>
              <Td>
                <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{d.bloodType}</span>
              </Td>
              <Td><span className="text-sm text-[#6B7280]">{d.contact}</span></Td>
              <Td><span className="text-sm text-[#6B7280]">{d.lastDonation ?? "—"}</span></Td>
              <Td>
                {d.eligibility.eligible ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200">Eligible now</span>
                ) : d.eligibility.nextEligibleDate && d.eligibility.daysRemaining > 0 ? (
                  <span title={d.eligibility.reason ?? ""} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    {fmtDate(d.eligibility.nextEligibleDate)}
                  </span>
                ) : (
                  <span title={d.eligibility.reason ?? ""} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Not eligible</span>
                )}
              </Td>
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

        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit Donor — ${editTarget.name}` : "Register New Donor"}
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
          {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}

          {duplicates && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900" data-testid="duplicate-panel">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" />
                {duplicates.code === "DUPLICATE_DONOR" ? "This donor already exists" : "Possible duplicate donors"}
              </div>
              <ul className="space-y-1.5">
                {duplicates.items.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-lg px-3 py-2 text-xs">
                    <span>
                      <b>{m.name}</b> · {m.id} · {m.age} yrs · {m.bloodType} · {m.contact}
                      <span className="block text-amber-700">{m.reason}</span>
                    </span>
                    <Link to={`/donors/${m.id}`} className="font-medium text-[#7C2D3E] underline whitespace-nowrap">Open record</Link>
                  </li>
                ))}
              </ul>
              {duplicates.code === "POSSIBLE_DUPLICATE" && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void submit(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#7C2D3E] text-white text-xs font-medium hover:bg-[#6a2535] cursor-pointer disabled:opacity-60"
                  >
                    This is a different person — save anyway
                  </button>
                  <span className="text-xs">Otherwise, open the existing record above.</span>
                </div>
              )}
            </div>
          )}

          {!editTarget && addMode === "manual" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <strong>Note:</strong> Adding a donor here registers them in the system. To record an actual donation (which creates the linked blood unit), use the <strong>Donations</strong> module or use <strong>Record Donation</strong> for an arrived pre-registrant in Event Details.
            </div>
          )}

          {!editTarget && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F0ED] rounded-lg" role="tablist" aria-label="How to add the donor">
              {([["manual", "Type details manually"], ["prereg", "From a pre-registration"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={addMode === k}
                  onClick={() => setAddMode(k)}
                  className={`py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${addMode === k ? "bg-white text-[#7C2D3E] shadow-sm" : "text-[#6B7280] hover:text-[#1C1C2E]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!editTarget && addMode === "prereg" ? (
            <PreRegPicker
              onDone={(msg) => { setModalOpen(false); void list.reload(); showToast(msg); }}
              onCancel={() => setModalOpen(false)}
            />
          ) : (
            <>
              <DonorFormFields form={form} set={set} statusOptions={DONOR_STATUS_OPTS} />

              <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Saving..." : editTarget ? "Save Changes" : "Register Donor"}
                </PrimaryButton>
                <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
              </div>
            </>
          )}
        </form>
      </Modal>

      <PasswordConfirmModal
        open={askPassword !== null}
        onClose={() => setAskPassword(null)}
        onConfirmed={() => { const next = askPassword; setAskPassword(null); next?.(); }}
        reason="view or change protected donor details"
      />

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
