import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { PageHeader, SearchInput, SecondaryButton, Select, Table, Td } from "../components/ui";
import { roleLabel } from "../components/RequireAuth";
import { api, ApiAuditLog, errorMessage } from "../lib/api";

const PAGE_SIZE = 25;

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6]",
  ADMIN: "bg-blue-50 text-blue-700 border border-blue-200",
  MEDTECH: "bg-purple-50 text-purple-700 border border-purple-200",
};

interface AuditResponse {
  items: ApiAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  actions: string[];
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Newest request wins, so a slow earlier answer can't overwrite a newer one.
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (actionFilter) params.set("action", actionFilter);

    api<AuditResponse>(`/audit-logs?${params}`)
      .then((data) => {
        if (requestId !== latestRequest.current) return;
        setLogs(data.items);
        setTotal(data.total);
        setActions(data.actions);
        setError("");
      })
      .catch((err) => {
        if (requestId === latestRequest.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (requestId === latestRequest.current) setLoading(false);
      });
  }, [debouncedSearch, actionFilter, page]);

  const actionOpts = [{ label: "All Actions", value: "" }, ...actions.map((a) => ({ label: a, value: a }))];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" subtitle="System-wide activity trail for accountability and traceability" />

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-4 border-b border-[#E8E5E2] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#7C2D3E]" />
            <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Activity Log</h3>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search user, action, or details..." />
            <Select value={actionFilter} onChange={(v) => { setActionFilter(v); setPage(1); }} options={actionOpts} />
          </div>
        </div>

        <Table headers={["Timestamp", "User", "Role", "Action", "Details"]}>
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-[#F9F8F7] transition-colors">
              <Td><span className="text-xs text-[#6B7280]">{formatTime(log.timestamp)}</span></Td>
              <Td><span className="text-sm text-[#1C1C2E] font-medium">{log.userName}</span></Td>
              <Td>
                {log.userRole ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[log.userRole]}`}>
                    {roleLabel(log.userRole)}
                  </span>
                ) : (
                  <span className="text-xs text-[#9CA3AF]">—</span>
                )}
              </Td>
              <Td><span className="text-xs text-[#1C1C2E] font-medium">{log.action}</span></Td>
              <Td><span className="text-xs text-[#6B7280]">{log.details}</span></Td>
            </tr>
          ))}
        </Table>

        {loading && logs.length === 0 && <div className="py-12 text-center text-sm text-[#6B7280]">Loading activity…</div>}
        {error && <div className="py-12 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B7280]">No log entries match your filters.</div>
        )}

        {total > 0 && (
          <div className="p-4 border-t border-[#E8E5E2] flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">Showing {from}–{to} of {total}</span>
            <div className="flex items-center gap-2">
              <SecondaryButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Previous</SecondaryButton>
              <span className="text-xs text-[#6B7280]">Page {page} of {pageCount}</span>
              <SecondaryButton onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || loading}>Next</SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
