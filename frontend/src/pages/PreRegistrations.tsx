import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList } from "lucide-react";
import { Badge, PageHeader, SearchInput, Select, Table, Td, Toast } from "../components/ui";
import PreRegActions from "../components/PreRegActions";
import { useData } from "../context/DataContext";
import { useApi, useDebounced } from "../lib/useApi";
import type { ApiEvent, ApiPreReg, Paged } from "../lib/api";

const attendanceOpts = [
  { label: "All Statuses", value: "" },
  { label: "Pre-registered", value: "Pre-registered" },
  { label: "Arrived", value: "Arrived" },
  { label: "Did Not Arrive", value: "Did Not Arrive" },
];

export default function PreRegistrations() {
  const { toast } = useData();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const q = useDebounced(search.trim(), 300);

  const params = new URLSearchParams({ pageSize: "500" });
  if (q) params.set("search", q);
  if (eventFilter) params.set("eventId", eventFilter);
  if (attendanceFilter) params.set("attendance", attendanceFilter);

  const list = useApi<Paged<ApiPreReg>>(`/pre-registrations?${params.toString()}`);
  const eventsQ = useApi<{ events: ApiEvent[] }>("/events");
  const rows = list.data?.items ?? [];

  const eventOpts = [
    { label: "All Events", value: "" },
    ...(eventsQ.data?.events ?? []).map((e) => ({ label: e.name, value: e.id })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Pre-Registrations" subtitle="All public pre-registrations across every donation event" />

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#7C2D3E]" />
            <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Pre-Registered Individuals</h3>
            <span className="text-xs text-[#6B7280]">({list.data?.total ?? 0})</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, contact, or ID..." />
            <Select value={eventFilter} onChange={setEventFilter} options={eventOpts} />
            <Select value={attendanceFilter} onChange={setAttendanceFilter} options={attendanceOpts} />
          </div>
        </div>

        {list.error && (
          <div className="m-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <span>{list.error}</span>
            <button onClick={() => void list.reload()} className="font-medium underline cursor-pointer">Try again</button>
          </div>
        )}

        <Table headers={["Name", "Event", "Contact", "Blood Type", "Pre-Reg Date", "Attendance", "Donation", "Actions"]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td>
                <div className="font-medium text-[#1C1C2E] text-sm">{p.name}</div>
                <div className="text-xs text-[#9CA3AF] font-mono">{p.id}</div>
                {p.donorId && <Link to={`/donors/${p.donorId}`} className="text-[10px] font-mono text-[#7C2D3E] hover:underline">{p.donorId}</Link>}
              </Td>
              <Td>
                <Link to={`/events/${p.eventId}`} className="text-xs text-[#7C2D3E] hover:underline">{p.eventName}</Link>
              </Td>
              <Td><span className="text-xs text-[#6B7280]">{p.contact}</span></Td>
              <Td><span className="text-xs font-medium text-[#1C1C2E]">{p.bloodType ?? "Unknown"}</span></Td>
              <Td><span className="text-xs text-[#6B7280]">{p.date}</span></Td>
              <Td><Badge status={p.attendance} /></Td>
              <Td><Badge status={p.outcome} /></Td>
              <Td><PreRegActions preReg={p} onChanged={list.reload} /></Td>
            </tr>
          ))}
        </Table>

        {list.loading && !list.data && <div className="py-12 text-center text-sm text-[#6B7280]">Loading pre-registrations...</div>}
        {list.data && rows.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B7280]">No pre-registrations match your filters.</div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
