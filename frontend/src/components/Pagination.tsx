import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [10, 25, 50];

// Previous / Next, "Page X of Y", a records-per-page choice and the range being shown.
// The page itself is loaded from the server, so only that page's records are ever fetched.
export default function Pagination({
  page, pageSize, total, onPage, onPageSize, pageSizes = PAGE_SIZES,
}: {
  page: number; pageSize: number; total: number;
  onPage: (page: number) => void; onPageSize?: (size: number) => void; pageSizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8E5E2] text-sm text-[#1C1C2E] bg-white hover:bg-[#F9F8F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#E8E5E2] text-sm text-[#6B7280]" data-testid="pagination">
      <div className="flex items-center gap-3">
        <span>
          {total === 0 ? "No records" : <>Showing <b className="text-[#1C1C2E]">{from}–{to}</b> of <b className="text-[#1C1C2E]">{total}</b></>}
        </span>
        {onPageSize && (
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Per page</span>
            <select
              aria-label="Records per page"
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="border border-[#E8E5E2] rounded-lg px-2 py-1 text-sm text-[#1C1C2E] bg-white cursor-pointer"
            >
              {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="px-1" data-testid="page-indicator">Page <b className="text-[#1C1C2E]">{page}</b> of <b className="text-[#1C1C2E]">{pages}</b></span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
