import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, ExternalLink, PackageCheck } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SecondaryButton, SearchInput, Select, Table, Td,
  Modal, Toast, FormField, TextInput, SelectInput,
} from "../components/ui";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiDonation, type ApiDonor, type ApiEvent, type Paged } from "../lib/api";
import { useApi, useDebounced } from "../lib/useApi";
import Pagination from "../components/Pagination";

const STATUS_OPTS = [
  { label: "All Status", value: "" },
  { label: "Completed", value: "Completed" },
  { label: "Deferred", value: "Deferred" },
  { label: "Cancelled", value: "Cancelled" },
];

const TESTING_OPTS = [
  { label: "All Testing Status", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Passed", value: "Passed" },
  { label: "For Confirmation", value: "For Confirmation" },
  { label: "Reactive", value: "Reactive" },
];

const COMPONENT_OPTS = [
  { label: "Whole Blood", value: "Whole Blood" },
  { label: "Packed RBC", value: "Packed RBC" },
  { label: "Fresh Frozen Plasma", value: "Fresh Frozen Plasma" },
  { label: "Platelet Concentrate", value: "Platelet Concentrate" },
];

type DonationForm = {
  donorId: string; eventId: string; date: string;
  bloodType: string; component: string; status: string; personnel: string; notes: string;
};

const EMPTY: DonationForm = {
  donorId: "", eventId: "", date: "", bloodType: "", component: "Whole Blood", status: "Completed", personnel: "", notes: "",
};

export default function Donations() {
  const { toast, showToast } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [testingFilter, setTestingFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DonationForm>(EMPTY);
  const [preRegId, setPreRegId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [q, statusFilter, testingFilter, pageSize]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("search", q);
  if (statusFilter) params.set("status", statusFilter);
  if (testingFilter) params.set("testingStatus", testingFilter);
  const list = useApi<Paged<ApiDonation>>(`/donations?${params.toString()}`);
  const donorsQ = useApi<Paged<ApiDonor>>("/donors?pageSize=500");
  const eventsQ = useApi<{ events: ApiEvent[] }>("/events");
  const donations = list.data?.items ?? [];
  const donors = donorsQ.data?.items ?? [];
  const events = eventsQ.data?.events ?? [];

  const set = (k: keyof DonationForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleDonorChange = (donorId: string) => {
    const donor = donors.find((d) => d.id === donorId);
    setForm((f) => ({ ...f, donorId, bloodType: donor?.bloodType ?? f.bloodType }));
  };

  const today = new Date().toISOString().slice(0, 10);

  // "Record Donation" from an event's pre-registration list opens this form
  // with the donor, event and pre-registration already filled in.
  const wantsNew = searchParams.get("new") === "1";
  const prefillDonor = searchParams.get("donorId") ?? "";
  useEffect(() => {
    if (!wantsNew) return;
    if (prefillDonor && !donorsQ.data) return; // wait for donors so the blood type can be filled in
    const donor = donors.find((d) => d.id === prefillDonor);
    setForm({ ...EMPTY, donorId: prefillDonor, eventId: searchParams.get("eventId") ?? "", bloodType: donor?.bloodType ?? "", date: today });
    setPreRegId(searchParams.get("preRegId") ?? "");
    setFormError("");
    setModalOpen(true);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew, donorsQ.data]);

  const openNew = () => { setForm({ ...EMPTY, date: today }); setPreRegId(""); setFormError(""); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.donorId || !form.date || !form.bloodType) return;
    setSaving(true);
    setFormError("");
    try {
      const { donation } = await api<{ donation: ApiDonation }>("/donations", {
        method: "POST",
        body: { ...form, preRegId },
      });
      setModalOpen(false);
      setForm(EMPTY);
      setPreRegId("");
      await Promise.all([list.reload(), donorsQ.reload()]);
      showToast(
        donation.bloodUnitId
          ? `Donation ${donation.id} recorded (${donation.bloodUnit?.component ?? form.component}). Blood unit ${donation.bloodUnitId} created — pending testing.`
          : `Donation ${donation.id} recorded as ${donation.status}. No blood unit was created.`,
        "success",
      );
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filtered = donations;

  // ── Issue / dispose a blood unit ──
  const [issueTarget, setIssueTarget] = useState<ApiDonation | null>(null);
  const [issueForm, setIssueForm] = useState({ issuedTo: "", issuedDate: "", note: "" });
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");

  const openIssue = (d: ApiDonation) => {
    setIssueForm({ issuedTo: "", issuedDate: today, note: "" });
    setIssueError("");
    setIssueTarget(d);
  };
  const isDisposal = !!issueTarget?.bloodUnit && ["Not Usable", "Expired"].includes(issueTarget.bloodUnit.status);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const unit = issueTarget?.bloodUnit;
    if (!issueTarget || !unit) return;
    setIssuing(true);
    setIssueError("");
    try {
      if (isDisposal) {
        await api(`/blood-units/${unit.id}/activities`, { method: "POST", body: { action: "Disposed", note: issueForm.note || `Disposed on ${issueForm.issuedDate}` } });
      } else {
        await api(`/blood-units/${unit.id}/issue`, { method: "POST", body: issueForm });
      }
      setIssueTarget(null);
      await list.reload();
      showToast(isDisposal ? `Unit ${unit.id} recorded as disposed.` : `Unit ${unit.id} issued to ${issueForm.issuedTo}.`, "success");
    } catch (err) {
      setIssueError(errorMessage(err));
    } finally {
      setIssuing(false);
    }
  };

  const donorOpts = [
    { label: "Select donor", value: "" },
    ...donors.map((d) => ({ label: `${d.name} (${d.id}) — ${d.bloodType}`, value: d.id })),
  ];
  const eventOpts = [
    { label: "— No event —", value: "" },
    ...events.map((e) => ({ label: e.name, value: e.id })),
  ];
  const BT_OPTS = [
    { label: "Select blood type", value: "" },
    ...["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => ({ label: b, value: b })),
  ];

  return (
    <div>
      <PageHeader
        title="Donations"
        subtitle={`${list.data?.total ?? 0} donation records — each completed donation is linked to a unique blood unit`}
        actions={
          <PrimaryButton onClick={openNew}>
            <Plus className="w-4 h-4" /> Add Donation Record
          </PrimaryButton>
        }
      />

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search ID, donor, event, blood unit..." />
          <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTS} />
          <Select value={testingFilter} onChange={setTestingFilter} options={TESTING_OPTS} />
          <span className="text-xs text-[#6B7280] ml-auto">{list.data?.total ?? 0} results</span>
        </div>

        <Table headers={["Donation ID", "Donor", "Event", "Date", "Blood Type", "Blood Unit ID", "Testing", "Unit Status", "Actions"]}>
          {filtered.map((d) => {
            const unit = d.bloodUnit;
            return (
              <tr key={d.id} className="hover:bg-[#F9F8F7] transition-colors">
                <Td>
                  <Link to={`/donations/${d.id}`} className="text-xs font-mono text-[#7C2D3E] font-medium hover:underline">{d.id}</Link>
                </Td>
                <Td>
                  <Link to={`/donors/${d.donorId}`} className="font-medium text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline text-sm">{d.donorName}</Link>
                  <div className="text-xs text-[#9CA3AF] font-mono">{d.donorId}</div>
                </Td>
                <Td>
                  {d.eventId ? (
                    <Link to={`/events/${d.eventId}`} className="text-xs text-[#6B7280] hover:text-[#7C2D3E] hover:underline">{d.eventName}</Link>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">—</span>
                  )}
                </Td>
                <Td><span className="text-sm text-[#6B7280]">{d.date}</span></Td>
                <Td>
                  <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{d.bloodType}</span>
                </Td>
                <Td>
                  {d.bloodUnitId
                    ? <Link to={`/blood-units/${d.bloodUnitId}`} className="text-xs font-mono text-[#7C2D3E] hover:underline">{d.bloodUnitId}</Link>
                    : <span className="text-xs text-[#9CA3AF]">—</span>}
                </Td>
                <Td>
                  {unit ? <Badge status={unit.testingStatus} /> : <span className="text-xs text-[#9CA3AF]">—</span>}
                </Td>
                <Td>
                  {unit ? <Badge status={unit.status} /> : <span className="text-xs text-[#9CA3AF]">—</span>}
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Link to={`/donations/${d.id}`} className="p-1.5 rounded-lg hover:bg-[#FDF2F4] text-[#6B7280] hover:text-[#7C2D3E] transition-colors inline-flex" title="View Donation Detail">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    {unit && (unit.status === "Usable" || unit.status === "Not Usable" || unit.status === "Expired") && (
                      <button
                        onClick={() => openIssue(d)}
                        className="flex items-center gap-1 text-xs border border-[#7C2D3E]/30 text-[#7C2D3E] hover:bg-[#FDF2F4] rounded-lg px-2 py-1 font-medium cursor-pointer whitespace-nowrap"
                        title={unit.status === "Usable" ? "Issue this blood unit" : "Record disposal of this unit"}
                      >
                        <PackageCheck className="w-3.5 h-3.5" /> {unit.status === "Usable" ? "Issued" : "Dispose"}
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>

        {list.loading && !list.data && <div className="py-12 text-center text-sm text-[#6B7280]">Loading donations...</div>}
        {list.error && (
          <div className="m-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <span>{list.error}</span>
            <button onClick={() => void list.reload()} className="font-medium underline cursor-pointer">Try again</button>
          </div>
        )}
        {list.data && filtered.length === 0 && (
          <div className="py-16 text-center text-[#6B7280]">
            <div className="text-4xl mb-2">🔍</div>
            <p className="font-medium">No donations found</p>
          </div>
        )}
        {list.data && list.data.total > 0 && (
          <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} onPageSize={setPageSize} pageSizes={[10, 25, 50]} />
        )}
      </div>

      {/* Add Donation modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Donation Record" size="md">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
          <strong>Note:</strong> A Completed donation automatically generates a paired Blood Unit (Pending Testing). Deferred or Cancelled donations create no unit. Laboratory personnel must manually enter testing results before the blood unit can be classified as usable.
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
          {preRegId && <div className="text-xs text-[#6B7280]">Recording from pre-registration <span className="font-mono text-[#7C2D3E]">{preRegId}</span></div>}
          <FormField label="Donor" required hint="Selecting a donor auto-fills their blood type.">
            <SelectInput value={form.donorId} onChange={handleDonorChange} options={donorOpts} required />
          </FormField>
          <FormField label="Associated Event">
            <SelectInput value={form.eventId} onChange={(v) => set("eventId", v)} options={eventOpts} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Donation Date" required>
              <TextInput type="date" value={form.date} onChange={(v) => set("date", v)} required />
            </FormField>
            <FormField label="Blood Type" required>
              <SelectInput value={form.bloodType} onChange={(v) => set("bloodType", v)} options={BT_OPTS} required />
            </FormField>
            <FormField label="Donation Type" required hint="What was collected from the donor.">
              <SelectInput value={form.component} onChange={(v) => set("component", v)} options={COMPONENT_OPTS} required />
            </FormField>
            <FormField label="Donation Status">
              <SelectInput value={form.status} onChange={(v) => set("status", v)} options={[
                { label: "Completed", value: "Completed" },
                { label: "Deferred", value: "Deferred" },
                { label: "Cancelled", value: "Cancelled" },
              ]} />
            </FormField>
            <FormField label="Personnel">
              <TextInput value={form.personnel} onChange={(v) => set("personnel", v)} placeholder="e.g. Nurse Maria Gonzales" />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] resize-none placeholder:text-gray-400"
            />
          </FormField>
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving..." : "Save Donation Record"}</PrimaryButton>
            <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      </Modal>

      {/* Issue / dispose modal */}
      <Modal open={!!issueTarget} onClose={() => setIssueTarget(null)} title={isDisposal ? "Record Disposal" : "Issue Blood Unit"} size="sm">
        {issueTarget?.bloodUnit && (
          <form onSubmit={(e) => void handleIssue(e)} className="space-y-4">
            {issueError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{issueError}</div>}
            <div className="grid grid-cols-3 gap-2 bg-[#F9F8F7] border border-[#E8E5E2] rounded-xl p-3 text-xs">
              <div><div className="text-[#9CA3AF] font-semibold uppercase">Unit</div><div className="font-mono text-[#7C2D3E] mt-0.5">{issueTarget.bloodUnit.id}</div></div>
              <div><div className="text-[#9CA3AF] font-semibold uppercase">Blood Type</div><div className="font-bold text-[#7C2D3E] mt-0.5">{issueTarget.bloodType}</div></div>
              <div><div className="text-[#9CA3AF] font-semibold uppercase">Status</div><div className="mt-0.5"><Badge status={issueTarget.bloodUnit.status} /></div></div>
            </div>
            {isDisposal ? (
              <p className="text-xs text-[#6B7280]">This unit is {issueTarget.bloodUnit.status}. Recording disposal keeps the unit in the traceability history.</p>
            ) : (
              <>
                <p className="text-xs text-[#6B7280]">Issuing takes the unit out of the inventory. This cannot be undone.</p>
                <FormField label="Issued To" required hint="Hospital, DOH office or other recipient.">
                  <TextInput value={issueForm.issuedTo} onChange={(v) => setIssueForm((f) => ({ ...f, issuedTo: v }))} placeholder="e.g. Cagayan Valley Medical Center" required />
                </FormField>
              </>
            )}
            <FormField label={isDisposal ? "Disposal Date" : "Date Issued"} required>
              <TextInput type="date" value={issueForm.issuedDate} onChange={(v) => setIssueForm((f) => ({ ...f, issuedDate: v }))} required />
            </FormField>
            <FormField label="Note">
              <TextInput value={issueForm.note} onChange={(v) => setIssueForm((f) => ({ ...f, note: v }))} placeholder={isDisposal ? "e.g. Incinerated per DOH protocol" : "e.g. Request no. / patient ward"} />
            </FormField>
            <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
              <PrimaryButton type="submit" disabled={issuing}>{issuing ? "Saving..." : isDisposal ? "Record Disposal" : "Confirm Issue"}</PrimaryButton>
              <SecondaryButton onClick={() => setIssueTarget(null)}>Cancel</SecondaryButton>
            </div>
          </form>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
