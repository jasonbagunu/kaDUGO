import { useState } from "react";
import { Link } from "react-router";
import { Plus, CheckCircle, AlertCircle, Clock, FlaskConical } from "lucide-react";
import {
  Badge, PageHeader, PrimaryButton, SecondaryButton, SearchInput, Table, Td,
  Modal, Toast, FormField, TextInput, SelectInput,
} from "../components/ui";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiTestListItem, type ApiTestRecord, type ApiUnit, type Paged } from "../lib/api";
import { useApi, useDebounced } from "../lib/useApi";

const TEST_NAMES = [
  "Hepatitis B Surface Antigen (HBsAg)",
  "Anti-HCV (Hepatitis C)",
  "HIV 1 & 2 Ag/Ab Combo",
  "Syphilis (VDRL/RPR)",
  "Malaria (MP-RDT)",
];

type TestResults = Record<string, "Non-Reactive" | "Reactive">;

type ActiveTab = "pending" | "completed";

export default function Testing() {
  const { toast, showToast } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>("pending");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [modalOpen, setModalOpen] = useState(false);

  const [unitId, setUnitId] = useState("");
  const [testingDate, setTestingDate] = useState("");
  const [results, setResults] = useState<TestResults>(
    Object.fromEntries(TEST_NAMES.map((n) => [n, "Non-Reactive" as const]))
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const qs = q ? `&search=${encodeURIComponent(q)}` : "";
  const unitsQ = useApi<Paged<ApiUnit>>("/blood-units?pageSize=500");
  const recordsQ = useApi<Paged<ApiTestListItem>>(`/test-records?pageSize=500${qs}`);
  const allUnits = unitsQ.data?.items ?? [];
  const bloodUnits = allUnits;
  const completedRecords = recordsQ.data?.items ?? [];
  const countBy = (st: string) => allUnits.filter((u) => u.testingStatus === st).length;

  const refresh = async () => { await Promise.all([unitsQ.reload(), recordsQ.reload()]); };

  const setResult = (name: string, v: "Non-Reactive" | "Reactive") =>
    setResults((r) => ({ ...r, [name]: v }));

  const resetModal = (preUnit = "") => {
    setUnitId(preUnit);
    setTestingDate(new Date().toISOString().slice(0, 10));
    setResults(Object.fromEntries(TEST_NAMES.map((n) => [n, "Non-Reactive" as const])));
    setFormError("");
  };

  const openForUnit = (id: string) => {
    resetModal(id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const { unit } = await api<{ unit: ApiUnit; testRecord: ApiTestRecord }>(`/blood-units/${unitId}/tests`, {
        method: "POST",
        body: { testingDate, tests: TEST_NAMES.map((name) => ({ name, result: results[name] })) },
      });
      setModalOpen(false);
      await refresh();
      showToast(
        unit.status === "Usable"
          ? `${unit.id} passed all screening — status updated to Usable.`
          : unit.status === "Not Usable"
          ? `${unit.id} confirmed reactive — status set to Not Usable.`
          : `${unit.id} has reactive result(s) — set to Quarantined (${unit.testingStatus}).`,
        unit.status === "Usable" ? "success" : "warning"
      );
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pendingUnits = allUnits.filter((u) => u.testingStatus === "Pending" || u.testingStatus === "For Confirmation");

  const unitOpts = [
    { label: "Select blood unit", value: "" },
    ...pendingUnits
      .map((u) => ({ label: `${u.id} — ${u.bloodType} (${u.testingStatus})`, value: u.id })),
  ];

  const filteredPending = pendingUnits.filter((u) => {
    const ql = q.toLowerCase();
    return u.id.toLowerCase().includes(ql) || u.donorName.toLowerCase().includes(ql) || u.donationId.toLowerCase().includes(ql);
  });

  const filteredCompleted = completedRecords;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blood Testing"
        subtitle="Laboratory screening for all collected blood units — results must be manually entered"
        actions={
          <PrimaryButton onClick={() => { resetModal(); setModalOpen(true); }}>
            <Plus className="w-4 h-4" /> Record Test Result
          </PrimaryButton>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending Testing", count: countBy("Pending"), icon: Clock, cls: "text-gray-600 bg-gray-50 border-gray-200" },
          { label: "Passed", count: countBy("Passed") + countBy("Completed"), icon: CheckCircle, cls: "text-green-700 bg-green-50 border-green-200" },
          { label: "For Confirmation", count: countBy("For Confirmation"), icon: AlertCircle, cls: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "Reactive", count: countBy("Reactive"), icon: AlertCircle, cls: "text-red-700 bg-red-50 border-red-200" },
        ].map(({ label, count, icon: Icon, cls }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>{count}</div>
              <div className="text-xs font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="flex border-b border-[#E8E5E2] px-1">
          {([
            { id: "pending", label: "Pending Testing", count: pendingUnits.length },
            { id: "completed", label: "Results Recorded", count: recordsQ.data?.total ?? 0 },
          ] as { id: ActiveTab; label: string; count: number }[]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === id ? "border-[#7C2D3E] text-[#7C2D3E]" : "border-transparent text-[#6B7280] hover:text-[#1C1C2E]"
              }`}
            >
              {label}
              <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${activeTab === id ? "bg-[#FDF2F4] text-[#7C2D3E]" : "bg-gray-100 text-[#6B7280]"}`}>{count}</span>
            </button>
          ))}
          <div className="flex-1 flex items-center justify-end px-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search unit ID, donor, donation..." />
          </div>
        </div>

        {activeTab === "pending" && (
          <div>
            {filteredPending.length === 0 ? (
              <div className="py-16 text-center text-[#6B7280]">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="font-medium text-[#1C1C2E]">No pending tests</p>
                <p className="text-sm mt-1">All blood units have been processed by the laboratory.</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span><strong>{filteredPending.length} blood unit{filteredPending.length !== 1 ? "s" : ""}</strong> awaiting laboratory screening or confirmation. These units must NOT be classified as usable until testing is complete.</span>
                </div>
                <Table headers={["Blood Unit ID", "Donation ID", "Donor", "Blood Type", "Component", "Collection Date", "Event", "Action"]}>
                  {filteredPending.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F9F8F7] transition-colors">
                      <Td>
                        <Link to={`/blood-units/${u.id}`} className="text-[#7C2D3E] font-medium hover:underline text-xs font-mono">{u.id}</Link>
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
                      <Td><span className="text-xs text-[#6B7280]">{u.component}</span></Td>
                      <Td><span className="text-xs text-[#6B7280]">{u.collectionDate}</span></Td>
                      <Td>
                        {u.eventId ? (
                          <Link to={`/events/${u.eventId}`} className="text-xs text-[#6B7280] hover:text-[#7C2D3E] hover:underline">{u.eventName}</Link>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">—</span>
                        )}
                      </Td>
                      <Td>
                        <button
                          onClick={() => openForUnit(u.id)}
                          className="flex items-center gap-1.5 text-xs bg-[#7C2D3E] hover:bg-[#6B2535] text-white rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer"
                        >
                          <FlaskConical className="w-3.5 h-3.5" /> {u.testingStatus === "For Confirmation" ? "Confirm Result" : "Record Result"}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </div>
        )}

        {activeTab === "completed" && (
          <div>
            {filteredCompleted.length === 0 ? (
              <div className="py-16 text-center text-[#6B7280]">
                <div className="text-4xl mb-2">🔍</div>
                <p className="font-medium">No completed test records found</p>
              </div>
            ) : (
              <Table headers={["Blood Unit ID", "Donation ID", "Blood Type", "Testing Date", "Screening Status", "Result", "Usability", "Tested By"]}>
                {filteredCompleted.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-[#F9F8F7] transition-colors">
                      <Td>
                        <Link to={`/blood-units/${r.unitId}`} className="text-[#7C2D3E] font-medium hover:underline text-xs font-mono">{r.unitId}</Link>
                      </Td>
                      <Td>
                        <Link to={`/donations/${r.donationId}`} className="text-xs font-mono text-[#7C2D3E] hover:underline">{r.donationId}</Link>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{r.bloodType}</span>
                      </Td>
                      <Td><span className="text-xs text-[#6B7280]">{r.testingDate}</span></Td>
                      <Td><Badge status={r.screeningStatus} /></Td>
                      <Td><span className="text-xs text-[#6B7280]">{r.result}</span></Td>
                      <Td><Badge status={r.usabilityStatus} /></Td>
                      <Td><span className="text-xs text-[#6B7280]">{r.testedBy ?? "—"}</span></Td>
                    </tr>
                  );
                })}
              </Table>
            )}

            {/* Latest test detail panel */}
            {filteredCompleted.length > 0 && (
              <div className="p-5 border-t border-[#E8E5E2]">
                <h3 className="font-semibold text-[#1C1C2E] mb-4 text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Screening Detail — {filteredCompleted[0].unitId}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCompleted[0].tests.map((test) => (
                    <div key={test.name} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${test.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                      <div className="mt-0.5">
                        {test.passed
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <AlertCircle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <div className={`font-medium text-xs ${test.passed ? "text-green-800" : "text-red-800"}`}>{test.name}</div>
                        <div className={`text-xs mt-0.5 font-semibold ${test.passed ? "text-green-700" : "text-red-700"}`}>{test.result}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Test Result modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Blood Screening Result" size="lg">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            Enter the actual laboratory screening results. The system will automatically determine usability status based on the results recorded.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Blood Unit" required hint="Only units with Pending or For Confirmation testing status are shown.">
                <SelectInput value={unitId} onChange={setUnitId} options={unitOpts} required />
              </FormField>
              {unitId && (() => {
                const u = bloodUnits.find(u => u.id === unitId);
                if (!u) return null;
                return (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#F9F8F7] rounded-lg p-2">
                      <span className="text-[#9CA3AF] font-semibold">Donation</span>
                      <div className="font-mono text-[#7C2D3E] mt-0.5">{u.donationId}</div>
                    </div>
                    <div className="bg-[#F9F8F7] rounded-lg p-2">
                      <span className="text-[#9CA3AF] font-semibold">Donor</span>
                      <div className="font-medium text-[#1C1C2E] mt-0.5">{u.donorName}</div>
                    </div>
                    <div className="bg-[#F9F8F7] rounded-lg p-2">
                      <span className="text-[#9CA3AF] font-semibold">Blood Type</span>
                      <div className="font-bold text-[#7C2D3E] mt-0.5">{u.bloodType}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <FormField label="Testing Date" required>
              <TextInput type="date" value={testingDate} onChange={setTestingDate} required />
            </FormField>
            <FormField label="Tested By" hint="Recorded automatically from your login.">
              <TextInput value="Your account" onChange={() => {}} disabled />
            </FormField>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1C1C2E] mb-3">Screening Test Results</p>
            <div className="space-y-2">
              {TEST_NAMES.map((name) => (
                <div key={name} className={`flex items-center justify-between p-3 rounded-xl border ${results[name] === "Reactive" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <span className="text-xs font-medium text-[#1C1C2E]">{name}</span>
                  <div className="flex items-center gap-3">
                    {(["Non-Reactive", "Reactive"] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio" name={name} value={opt}
                          checked={results[name] === opt}
                          onChange={() => setResult(name, opt)}
                          className="accent-[#7C2D3E]"
                        />
                        <span className={`text-xs font-medium ${opt === "Reactive" ? "text-red-700" : "text-green-700"}`}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-3 p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${Object.values(results).every((r) => r === "Non-Reactive") ? "bg-green-50 border-green-300 text-green-800" : "bg-amber-50 border-amber-300 text-amber-800"}`}>
              {Object.values(results).every((r) => r === "Non-Reactive")
                ? <><CheckCircle className="w-4 h-4" /> All Non-Reactive — blood unit will be classified as <strong>Usable</strong></>
                : <><AlertCircle className="w-4 h-4" /> Reactive result detected — blood unit will be set to <strong>Quarantined</strong> (For Confirmation)</>}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton type="submit" disabled={!unitId || !testingDate || saving}>{saving ? "Saving..." : "Save Test Result"}</PrimaryButton>
            <SecondaryButton onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
