import { useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./ui";
import { api, errorMessage, type ApiDonor, type ApiPreReg, type Paged } from "../lib/api";
import { useApi, useDebounced } from "../lib/useApi";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// "From a pre-registration": choose someone who signed up through an event link
// and register them as a donor with the details they already gave (name, birth
// date, contact and address). Nothing needs to be typed again.
export default function PreRegPicker({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [selected, setSelected] = useState<ApiPreReg | null>(null);
  const [bloodType, setBloodType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const params = new URLSearchParams({ unregistered: "true", pageSize: "8" });
  if (q) params.set("search", q);
  const list = useApi<Paged<ApiPreReg>>(`/pre-registrations?${params.toString()}`);
  const rows = list.data?.items ?? [];

  const pick = (p: ApiPreReg) => { setSelected(p); setBloodType(p.bloodType ?? ""); setError(""); };

  const register = async () => {
    if (!selected) return;
    if (!selected.bloodType && !bloodType) { setError("Choose the donor's blood type."); return; }
    setSaving(true);
    setError("");
    try {
      const { donor, created } = await api<{ donor: ApiDonor; created: boolean }>(
        `/pre-registrations/${selected.id}/register-donor`,
        { method: "POST", body: { allowNotArrived: true, ...(bloodType ? { bloodType } : {}) } },
      );
      onDone(created ? `${selected.name} registered as donor ${donor.id}.` : `${selected.name} linked to the existing donor ${donor.id}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="prereg-picker">
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>}

      <div className="relative">
        <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pre-registered people by name, contact or ID..."
          className="w-full pl-9 pr-3 py-2.5 border border-[#E8E5E2] rounded-lg text-sm focus:outline-none focus:border-[#7C2D3E]"
        />
      </div>

      <div className="border border-[#E8E5E2] rounded-xl divide-y divide-[#F3F0ED] max-h-64 overflow-y-auto">
        {list.loading && !list.data && <div className="py-6 text-center text-sm text-[#6B7280]">Loading...</div>}
        {list.data && rows.length === 0 && (
          <div className="py-6 text-center text-sm text-[#6B7280]">No pre-registered people waiting to be added as donors.</div>
        )}
        {rows.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p)}
            className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${selected?.id === p.id ? "bg-[#FDF2F4]" : "hover:bg-[#F9F8F7]"}`}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#1C1C2E] truncate">{p.name}</span>
              <span className="block text-xs text-[#6B7280] truncate">{p.id} • {p.eventName} • {p.attendance}</span>
            </span>
            <span className="text-xs font-bold text-[#7C2D3E] whitespace-nowrap">{p.bloodType ?? "No blood type"}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-[#F9F8F7] border border-[#E8E5E2] rounded-xl p-4 text-sm space-y-1" data-testid="prereg-selected">
          <div className="flex items-center gap-2 font-semibold text-[#1C1C2E]"><UserCheck className="w-4 h-4 text-[#7C2D3E]" /> {selected.name}</div>
          <div className="text-[#6B7280] text-xs">Born {selected.dob ?? "—"} • {selected.sex ?? "—"} • {selected.contact}</div>
          <div className="text-[#6B7280] text-xs">{selected.address || "No address"}</div>
          {!selected.bloodType && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-[#1C1C2E] mb-1">Blood type <span className="text-[#7C2D3E]">*</span></label>
              <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="px-3 py-2 border border-[#E8E5E2] rounded-lg text-sm bg-white">
                <option value="">Select blood type</option>
                {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {(!selected.dob || !selected.sex) && (
            <div className="text-xs text-red-600 pt-1">This pre-registration has no birth date or sex. Use "Type details manually" instead.</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
        <PrimaryButton onClick={() => void register()} disabled={!selected || saving || !selected.dob || !selected.sex}>
          {saving ? "Registering..." : "Register as Donor"}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
