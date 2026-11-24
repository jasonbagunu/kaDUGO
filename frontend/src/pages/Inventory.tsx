import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Clock, Package } from "lucide-react";
import { PageHeader, SearchInput, Select, Table, Td, Badge } from "../components/ui";
import type { ApiInventorySummary, ApiUnit, Paged } from "../lib/api";
import { useApi, useDebounced } from "../lib/useApi";
import Pagination from "../components/Pagination";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
type BT = typeof BLOOD_TYPES[number];


const statusOpts = [
  { label: "All Status", value: "" },
  { label: "Usable", value: "Usable" },
  { label: "Quarantined", value: "Quarantined" },
  { label: "Not Usable", value: "Not Usable" },
  { label: "Expired", value: "Expired" },
];
const btOpts = [
  { label: "All Blood Types", value: "" },
  ...BLOOD_TYPES.map((b) => ({ label: b, value: b })),
];

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [bt, setBt] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [q, bt, status, pageSize]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("search", q);
  if (bt) params.set("bloodType", bt);
  if (status) params.set("status", status);
  const summaryQ = useApi<ApiInventorySummary>("/inventory/summary");
  const unitsQ = useApi<Paged<ApiUnit>>(`/blood-units?${params.toString()}`);
  const summary = summaryQ.data;
  const filtered = unitsQ.data?.items ?? [];
  const byType = new Map((summary?.byBloodType ?? []).map((r) => [r.bloodType, r]));

  const totalUsable = summary?.totals.usable ?? 0;
  const totalQ = summary?.totals.quarantined ?? 0;
  const totalNU = summary?.totals.notUsable ?? 0;
  const totalExp = summary?.totals.expiringSoon ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Blood Inventory" subtitle="Current blood unit inventory and storage status" />

      {(summaryQ.error || unitsQ.error) && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{summaryQ.error || unitsQ.error}</span>
          <button onClick={() => { void summaryQ.reload(); void unitsQ.reload(); }} className="font-medium underline cursor-pointer">Try again</button>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Usable Units", value: totalUsable, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: Package },
          { label: "Quarantined", value: totalQ, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: AlertTriangle },
          { label: "Not Usable", value: totalNU, color: "text-red-700", bg: "bg-red-50 border-red-200", icon: AlertTriangle },
          { label: "Expiring Soon", value: totalExp, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
                <div className={`text-xs font-medium ${color}`}>{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Blood Type Grid */}
      <div>
        <h3 className="font-semibold text-[#1C1C2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory by Blood Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {BLOOD_TYPES.map((bt) => {
            const data = byType.get(bt) ?? { usable: 0, quarantined: 0, expiringSoon: 0, lowStockThreshold: 1, isLowStock: false };
            const isLow = summaryQ.data ? data.isLowStock : false;
            const pct = Math.min((data.usable / (data.lowStockThreshold * 2)) * 100, 100);
            return (
              <div key={bt} className={`bg-white rounded-xl border shadow-sm p-4 text-center ${isLow ? "border-[#7C2D3E]/40" : "border-[#E8E5E2]"}`}>
                <div className={`text-xl font-bold mb-1 ${isLow ? "text-[#7C2D3E]" : "text-[#1C1C2E]"}`} style={{ fontFamily: "Outfit, sans-serif" }}>{bt}</div>
                <div className="text-3xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{data.usable}</div>
                <div className="text-[10px] text-[#9CA3AF] mb-2">usable</div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isLow ? "bg-[#7C2D3E]" : "bg-green-600"}`} style={{ width: `${pct}%` }} />
                </div>
                {isLow && (
                  <div className="text-[9px] text-[#7C2D3E] mt-1.5 font-bold uppercase tracking-wide">Low Stock</div>
                )}
                <div className="mt-2 space-y-0.5">
                  {data.expiringSoon > 0 && <div className="text-[9px] text-amber-700">{data.expiringSoon} expiring soon</div>}
                  {data.quarantined > 0 && <div className="text-[9px] text-amber-700">{data.quarantined} quarantined</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main inventory table */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search unit ID, blood type..." />
          <Select value={bt} onChange={setBt} options={btOpts} />
          <Select value={status} onChange={setStatus} options={statusOpts} />
          <span className="text-xs text-[#6B7280] ml-auto">{unitsQ.data?.total ?? 0} units</span>
        </div>

        <Table headers={["Blood Unit ID", "Blood Type", "Component", "Status", "Storage Location", "Collection Date", "Expiration Date", "Days Until Expiry", "Actions"]}>
          {filtered.map((u) => {
            const daysLeft = u.daysToExpiry;
            const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7 && u.status === "Usable";
            return (
              <tr key={u.id} className="hover:bg-[#F9F8F7] transition-colors">
                <Td><span className="text-xs font-mono text-[#7C2D3E] font-medium">{u.id}</span></Td>
                <Td>
                  <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{u.bloodType}</span>
                </Td>
                <Td><span className="text-xs text-[#6B7280]">{u.component}</span></Td>
                <Td><Badge status={u.status} /></Td>
                <Td><span className="text-xs text-[#6B7280]">{u.storageLocation}</span></Td>
                <Td><span className="text-xs text-[#6B7280]">{u.collectionDate}</span></Td>
                <Td>
                  <span className={`text-xs ${u.status === "Expired" ? "text-gray-400 line-through" : isExpiringSoon ? "text-amber-700 font-semibold" : "text-[#6B7280]"}`}>
                    {u.expirationDate}
                  </span>
                </Td>
                <Td>
                  {u.status === "Expired" ? (
                    <span className="text-xs text-gray-400">Expired</span>
                  ) : (
                    <span className={`text-xs font-semibold ${daysLeft <= 7 ? "text-red-700" : daysLeft <= 14 ? "text-amber-700" : "text-green-700"}`}>
                      {daysLeft >= 0 ? `${daysLeft}d` : "Expired"}
                    </span>
                  )}
                </Td>
                <Td>
                  <Link to={`/blood-units/${u.id}`} className="text-xs text-[#7C2D3E] hover:underline cursor-pointer">View</Link>
                </Td>
              </tr>
            );
          })}
        </Table>
        {unitsQ.loading && !unitsQ.data && <div className="py-10 text-center text-sm text-[#6B7280]">Loading inventory...</div>}
        {unitsQ.data && filtered.length === 0 && <div className="py-10 text-center text-sm text-[#6B7280]">No units match your filters.</div>}
        {unitsQ.data && unitsQ.data.total > 0 && (
          <Pagination page={page} pageSize={pageSize} total={unitsQ.data.total} onPage={setPage} onPageSize={setPageSize} pageSizes={[10, 25, 50]} />
        )}
      </div>
    </div>
  );
}
