import { useState } from "react";
import { Link } from "react-router";
import { Plus, Calendar, MapPin, Users, Droplets, ChevronRight } from "lucide-react";
import { Badge, PageHeader, PrimaryButton, SearchInput, Select } from "../components/ui";
import { useApi, useDebounced } from "../lib/useApi";
import type { ApiEvent } from "../lib/api";

const statusOpts = [
  { label: "All Status", value: "" },
  { label: "Upcoming", value: "Upcoming" },
  { label: "Ongoing", value: "Ongoing" },
  { label: "Completed", value: "Completed" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function Events() {
  const { data, loading, error, reload } = useApi<{ events: ApiEvent[] }>("/events");
  const events = data?.events ?? [];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounced(search, 150).toLowerCase();

  const filtered = events.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
    const matchStatus = !status || e.status === status;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <PageHeader
        title="Donation Events"
        subtitle={`${events.length} blood donation events`}
        actions={
          <Link to="/events/create">
            <PrimaryButton>
              <Plus className="w-4 h-4" /> Create Event
            </PrimaryButton>
          </Link>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(["Upcoming", "Ongoing", "Completed", "Cancelled"] as const).map((s) => {
          const count = events.filter((e) => e.status === s).length;
          const colors: Record<string, string> = {
            Upcoming: "bg-blue-50 border-blue-200 text-blue-700",
            Ongoing: "bg-green-50 border-green-200 text-green-700",
            Completed: "bg-gray-50 border-gray-200 text-gray-600",
            Cancelled: "bg-red-50 border-red-200 text-red-700",
          };
          return (
            <div key={s} className={`rounded-xl border p-3 flex items-center gap-3 ${colors[s]}`}>
              <div className={`text-2xl font-bold`} style={{ fontFamily: "Outfit, sans-serif" }}>{count}</div>
              <div className="text-xs font-medium">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search event name, location..." />
        <Select value={status} onChange={setStatus} options={statusOpts} />
        <span className="text-xs text-[#6B7280] ml-auto">{filtered.length} events</span>
      </div>

      {loading && !data && <div className="py-16 text-center text-sm text-[#6B7280]">Loading events...</div>}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => void reload()} className="font-medium underline cursor-pointer">Try again</button>
        </div>
      )}
      {data && filtered.length === 0 && (
        <div className="py-16 text-center text-[#6B7280]">
          <p className="font-medium">{events.length === 0 ? "No events yet" : "No events match your filters"}</p>
          {events.length === 0 && <p className="text-xs mt-1">Click Create Event to schedule your first donation drive.</p>}
        </div>
      )}

      {/* Event cards */}
      <div className="space-y-3">
        {filtered.map((event) => {
          const conversionRate = event.preRegistered > 0
            ? Math.round((event.donations / event.preRegistered) * 100)
            : 0;

          return (
            <div key={event.id} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm hover:border-[#D0C8C2] transition-colors">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge status={event.status} />
                      {event.registrationOpen && (
                        <span className="text-[10px] bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-2 py-0.5 font-medium">Registration Open</span>
                      )}
                    </div>
                    <h3 className="font-bold text-[#1C1C2E] text-base leading-snug" style={{ fontFamily: "Outfit, sans-serif" }}>{event.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                        <Calendar className="w-3.5 h-3.5" />
                        {event.date} · {event.startTime} – {event.endTime}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.location}
                      </div>
                    </div>
                  </div>

                  <Link to={`/events/${event.id}`} className="flex items-center gap-1.5 text-sm text-[#7C2D3E] hover:text-[#6B2535] font-medium whitespace-nowrap">
                    View Details <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#E8E5E2]">
                  {[
                    { label: "Pre-Registered", value: event.preRegistered, icon: Users },
                    { label: "Arrived", value: event.arrived, icon: Users },
                    { label: "Eligible", value: event.eligibleDonors, icon: Users },
                    { label: "Donations", value: event.donations, icon: Droplets },
                    { label: "Blood Units", value: event.bloodUnits, icon: Droplets },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="text-center">
                      <div className="text-xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide">{label}</div>
                    </div>
                  ))}
                </div>

                {event.status !== "Upcoming" && event.preRegistered > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                      <span>Conversion rate (donations / pre-registered)</span>
                      <span className="font-semibold text-[#1C1C2E]">{conversionRate}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7C2D3E] rounded-full" style={{ width: `${conversionRate}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
