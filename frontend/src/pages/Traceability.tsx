import { useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, Droplet, MapPin, User, Calendar, FlaskConical, Package, ChevronRight } from "lucide-react";
import { Badge, Toast } from "../components/ui";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiUnitDetail } from "../lib/api";
import { useApi } from "../lib/useApi";

export default function Traceability() {
  const { id } = useParams();
  const { toast, showToast } = useData();
  const { data, loading, error, reload } = useApi<ApiUnitDetail>(id ? `/blood-units/${encodeURIComponent(id)}` : null);
  const [busy, setBusy] = useState(false);

  if (!data) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Link to="/blood-units" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E]"><ArrowLeft className="w-4 h-4" /> Back to Blood Units</Link>
        {loading
          ? <div className="py-16 text-center text-sm text-[#6B7280]">Loading blood unit...</div>
          : <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error || "Blood unit not found."}</div>}
      </div>
    );
  }

  const unit = data.unit;
  const history = data.history;
  const testRecord = data.testRecords[0] ?? null;
  const isPendingTesting = unit.testingStatus === "Pending" && !testRecord;
  const processedEntry = history.find((h) => h.action === "Processed");
  const disposed = history.some((h) => h.action === "Disposed");
  const finalStatus = unit.status === "Not Usable" || unit.status === "Expired";

  const record = async (action: "Processed" | "Disposed") => {
    setBusy(true);
    try {
      await api(`/blood-units/${unit.id}/activities`, { method: "POST", body: { action } });
      await reload();
      showToast(action === "Processed" ? "Processing recorded." : "Disposal recorded.");
    } catch (e) {
      showToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const statusColor: Record<string, string> = {
    Usable: "text-green-700 bg-green-50 border-green-300",
    Quarantined: "text-amber-700 bg-amber-50 border-amber-300",
    "Not Usable": "text-red-700 bg-red-50 border-red-300",
    Expired: "text-gray-600 bg-gray-50 border-gray-300",
    Issued: "text-blue-700 bg-blue-50 border-blue-300",
    "Pending Testing": "text-gray-600 bg-gray-50 border-gray-300",
  };

  const testingStepStatus = (): "completed" | "warning" | "error" | "pending" => {
    if (isPendingTesting) return "pending";
    if (unit.testingStatus === "Passed" || unit.testingStatus === "Completed") return "completed";
    if (unit.testingStatus === "For Confirmation") return "warning";
    if (unit.testingStatus === "Reactive") return "error";
    return "pending";
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <Link to="/blood-units" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Blood Units
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-widest mb-1">Blood Unit Traceability</p>
            <h1 className="text-2xl font-bold text-[#1C1C2E] font-mono" style={{ fontFamily: "Outfit, sans-serif" }}>{unit.id}</h1>
          </div>
          <div className={`px-5 py-2.5 rounded-xl border-2 font-bold text-base tracking-wide ${statusColor[unit.status] ?? "text-gray-600 bg-gray-50 border-gray-300"}`}>
            {unit.status.toUpperCase()}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#E8E5E2]">
          {[
            { label: "Blood Type", value: unit.bloodType, red: true },
            { label: "Component", value: unit.component },
            { label: "Collection Date", value: unit.collectionDate },
            { label: "Expiration Date", value: unit.expirationDate },
          ].map(({ label, value, red }) => (
            <div key={label}>
              <div className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mb-1">{label}</div>
              <div className={`font-semibold text-sm ${red ? "text-[#7C2D3E]" : "text-[#1C1C2E]"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#E8E5E2] flex-wrap">
          <span className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide">Linked to:</span>
          <Link to={`/donations/${unit.donationId}`} className="inline-flex items-center gap-1 text-xs bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-3 py-1 hover:bg-[#F9E5E9] transition-colors font-mono">
            {unit.donationId} <ChevronRight className="w-3 h-3" />
          </Link>
          <Link to={`/donors/${unit.donorId}`} className="inline-flex items-center gap-1 text-xs bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-3 py-1 hover:bg-[#F9E5E9] transition-colors">
            {unit.donorName} <ChevronRight className="w-3 h-3" />
          </Link>
          {unit.eventId && (
            <Link to={`/events/${unit.eventId}`} className="inline-flex items-center gap-1 text-xs bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-3 py-1 hover:bg-[#F9E5E9] transition-colors">
              {unit.eventName} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Pending testing banner */}
      {isPendingTesting && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Awaiting Laboratory Testing</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This blood unit has been collected but has not yet been processed by the laboratory. Testing, processing, storage, and usability classification will appear here once laboratory personnel record the screening results.
            </p>
            <Link to="/testing" className="inline-flex items-center gap-1 text-xs text-amber-800 font-semibold hover:underline mt-2">
              Go to Blood Testing <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
        <h2 className="font-bold text-[#1C1C2E] text-lg mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>Lifecycle Timeline</h2>

        <div className="relative">
          {/* Vertical connector */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-[#7C2D3E] via-[#7C2D3E]/30 to-[#E8E5E2]" />

          <div className="space-y-0">
            {/* COLLECTION — always completed */}
            <TimelineStep
              icon={<Droplet className="w-4 h-4 text-[#7C2D3E]" />}
              label="Collection"
              status="completed"
              time={unit.collectionDate}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoField icon={<Droplet className="w-3.5 h-3.5" />} label="Blood Unit" value={unit.id} mono />
                <InfoField icon={<Calendar className="w-3.5 h-3.5" />} label="Collection Date" value={unit.collectionDate} />
                <InfoField icon={<User className="w-3.5 h-3.5" />} label="Donor" value={`${unit.donorName} (${unit.donorId})`} />
                <InfoField icon={<Calendar className="w-3.5 h-3.5" />} label="Event" value={unit.eventName || "—"} />
                <InfoField icon={<Package className="w-3.5 h-3.5" />} label="Component" value={unit.component} />
                <InfoField icon={<Calendar className="w-3.5 h-3.5" />} label="Expiration Date" value={unit.expirationDate} />
              </div>
            </TimelineStep>

            {/* TESTING — pending if not yet tested */}
            <TimelineStep
              icon={<FlaskConical className="w-4 h-4 text-[#7C2D3E]" />}
              label="Testing & Screening"
              status={testingStepStatus()}
              time={testRecord ? testRecord.testingDate : "Pending"}
            >
              {isPendingTesting ? (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF] italic py-1">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  Awaiting laboratory screening — no results recorded yet.
                </div>
              ) : testRecord ? (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {testRecord.tests.map((test) => (
                      <div key={test.name} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${test.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          {test.passed
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
                          <span className={`font-medium ${test.passed ? "text-green-800" : "text-red-800"}`}>{test.name}</span>
                        </div>
                        <span className={`font-semibold ${test.passed ? "text-green-700" : "text-red-700"}`}>{test.result}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E8E5E2]">
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <User className="w-3.5 h-3.5" /> Tested by: {testRecord.testedBy ?? "—"}
                    </div>
                    <Badge status={unit.testingStatus} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF] italic py-1">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  No testing records available.
                </div>
              )}
            </TimelineStep>

            {/* PROCESSING — recorded by staff */}
            <TimelineStep
              icon={<Package className="w-4 h-4 text-[#7C2D3E]" />}
              label="Processing"
              status={processedEntry ? "completed" : unit.status === "Not Usable" ? "error" : "pending"}
              time={processedEntry ? processedEntry.occurredAt.slice(0, 10) : "Not recorded"}
            >
              {processedEntry ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoField icon={<Package className="w-3.5 h-3.5" />} label="Component" value={unit.component} />
                  <InfoField icon={<User className="w-3.5 h-3.5" />} label="Processed by" value={processedEntry.performedBy ?? "—"} />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-xs text-[#9CA3AF] italic py-1">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4 flex-shrink-0" /> No processing step recorded yet.</span>
                  {!finalStatus && !isPendingTesting && (
                    <button disabled={busy} onClick={() => void record("Processed")} className="not-italic text-xs bg-[#7C2D3E] hover:bg-[#6B2535] disabled:opacity-60 text-white rounded-lg px-2.5 py-1.5 font-medium cursor-pointer">Mark as Processed</button>
                  )}
                </div>
              )}
            </TimelineStep>

            {/* STORAGE — only show details if tested */}
            <TimelineStep
              icon={<MapPin className="w-4 h-4 text-[#7C2D3E]" />}
              label="Storage"
              status={isPendingTesting ? "pending" : unit.status === "Expired" || unit.status === "Not Usable" ? "error" : "completed"}
              time={isPendingTesting ? "Pending" : unit.lastActivity ?? "—"}
            >
              {isPendingTesting ? (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF] italic py-1">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  Storage location will be assigned after usability is determined.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoField icon={<MapPin className="w-3.5 h-3.5" />} label="Storage Location" value={unit.storageLocation} />
                  <InfoField icon={<Package className="w-3.5 h-3.5" />} label="Shelf" value={unit.shelf !== "—" ? `Shelf ${unit.shelf}` : "—"} />
                  <InfoField icon={<Package className="w-3.5 h-3.5" />} label="Position" value={unit.position !== "—" ? `Position ${unit.position}` : "—"} />
                </div>
              )}
            </TimelineStep>

            {/* CURRENT STATUS */}
            <TimelineStep
              icon={<CheckCircle className="w-4 h-4 text-[#7C2D3E]" />}
              label="Current Status"
              status={
                isPendingTesting ? "pending"
                  : unit.status === "Usable" || unit.status === "Issued" ? "completed"
                  : unit.status === "Quarantined" ? "warning"
                  : "error"
              }
              time={isPendingTesting ? "Pending" : unit.lastActivity ?? "—"}
              isLast
            >
              {isPendingTesting ? (
                <div className="flex items-start gap-3">
                  <div className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 font-bold text-gray-500">
                    PENDING TESTING
                  </div>
                  <div>
                    <div className="text-sm text-[#1C1C2E] font-medium">Awaiting laboratory screening</div>
                    <div className="text-xs text-[#6B7280] mt-0.5">Usability cannot be determined until testing is complete</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className={`px-6 py-3 rounded-xl border-2 font-bold text-lg ${statusColor[unit.status] ?? "text-gray-600 bg-gray-50 border-gray-300"}`}>
                    {unit.status.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-[#1C1C2E] font-medium">{unit.lastActivityNote}</div>
                    <div className="text-xs text-[#6B7280] mt-0.5">Last updated: {unit.lastActivity ?? "—"}</div>
                  </div>
                </div>
              )}
            </TimelineStep>
          </div>
        </div>
      </div>

      {/* Full activity history */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#1C1C2E] text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Activity History</h2>
          {finalStatus && !disposed && (
            <button disabled={busy} onClick={() => void record("Disposed")} className="text-xs border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60 rounded-lg px-3 py-1.5 font-medium cursor-pointer">Record Disposal</button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No activity recorded.</p>
        ) : (
          <ul className="divide-y divide-[#F3F0ED]">
            {history.map((h) => (
              <li key={h.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#1C1C2E]">{h.action}</div>
                  {h.note && <div className="text-xs text-[#6B7280] mt-0.5">{h.note}</div>}
                </div>
                <div className="text-right text-xs text-[#9CA3AF] whitespace-nowrap">
                  <div>{h.occurredAt.slice(0, 10)}</div>
                  {h.performedBy && <div>{h.performedBy}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

function TimelineStep({
  icon, label, status, time, children, isLast = false,
}: {
  icon: React.ReactNode;
  label: string;
  status: "completed" | "warning" | "error" | "pending";
  time: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  const dotBg = {
    completed: "bg-[#7C2D3E] border-[#7C2D3E]",
    warning: "bg-amber-500 border-amber-500",
    error: "bg-red-600 border-red-600",
    pending: "bg-white border-[#D1D5DB]",
  }[status];

  const dotIcon = {
    completed: <CheckCircle className="w-3 h-3 text-white" />,
    warning: <AlertCircle className="w-3 h-3 text-white" />,
    error: <AlertCircle className="w-3 h-3 text-white" />,
    pending: <Clock className="w-3 h-3 text-[#9CA3AF]" />,
  }[status];

  const cardStyle = status === "pending"
    ? "bg-[#F9F8F7] border border-dashed border-[#D1D5DB] opacity-70"
    : "bg-[#F9F8F7] border border-[#E8E5E2] hover:border-[#D0C8C2]";

  return (
    <div className={`relative pl-14 ${isLast ? "pb-0" : "pb-6"}`}>
      <div className={`absolute left-3 top-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${dotBg}`}>
        {dotIcon}
      </div>

      <div className={`rounded-xl p-4 transition-colors ${cardStyle}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-[#1C1C2E] text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>{label}</span>
            {status === "pending" && (
              <span className="text-[10px] bg-gray-100 text-[#9CA3AF] border border-gray-200 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">Pending</span>
            )}
          </div>
          <span className={`text-xs ${status === "pending" ? "text-[#9CA3AF] italic" : "text-[#9CA3AF]"}`}>{time}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoField({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-[#9CA3AF] mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide">{label}</div>
        <div className={`text-xs text-[#1C1C2E] font-medium mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
