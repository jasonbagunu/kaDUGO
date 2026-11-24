import { useMemo } from "react";
import { EMPTY_ADDRESS, listBarangays, listCities, listProvinces, listRegions, type AddressValue, type Place } from "../lib/phAddress";

const selectClass =
  "w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] cursor-pointer disabled:bg-gray-50 disabled:text-[#9CA3AF] disabled:cursor-not-allowed";

function Pick({
  label, value, onChange, places, placeholder, disabled,
}: { label: string; value: string; onChange: (code: string) => void; places: Place[]; placeholder: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">
        {label}<span className="text-[#7C2D3E] ml-0.5">*</span>
      </label>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        required
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {places.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
      </select>
    </div>
  );
}

// Region > Province > City/Municipality > Barangay. Each list depends on the one before it,
// stays disabled until that one is chosen, and clears when a higher level changes.
export default function AddressSelect({
  value, onChange, className = "", idPrefix = "addr",
}: { value: AddressValue; onChange: (v: AddressValue) => void; className?: string; idPrefix?: string }) {
  const regions = useMemo(() => listRegions(), []);
  const provinces = useMemo(() => listProvinces(value.regionCode), [value.regionCode]);
  const cities = useMemo(() => listCities(value.regionCode, value.provinceCode), [value.regionCode, value.provinceCode]);
  const barangays = useMemo(() => listBarangays(value.cityCode), [value.cityCode]);

  return (
    <div className={`space-y-3 ${className}`} data-testid={`${idPrefix}-select`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Pick
          label="Region" placeholder="Select region" places={regions} value={value.regionCode}
          onChange={(regionCode) => onChange({ ...EMPTY_ADDRESS, street: value.street, regionCode })}
        />
        <Pick
          label="Province" placeholder={value.regionCode ? "Select province" : "Select a region first"}
          places={provinces} value={value.provinceCode} disabled={!value.regionCode}
          onChange={(provinceCode) => onChange({ ...value, provinceCode, cityCode: "", barangayCode: "" })}
        />
        <Pick
          label="City / Municipality" placeholder={value.provinceCode ? "Select city or municipality" : "Select a province first"}
          places={cities} value={value.cityCode} disabled={!value.provinceCode}
          onChange={(cityCode) => onChange({ ...value, cityCode, barangayCode: "" })}
        />
        <Pick
          label="Barangay" placeholder={value.cityCode ? "Select barangay" : "Select a city first"}
          places={barangays} value={value.barangayCode} disabled={!value.cityCode}
          onChange={(barangayCode) => onChange({ ...value, barangayCode })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">
          Street / House No. <span className="text-xs font-normal text-[#9CA3AF]">(optional)</span>
        </label>
        <input
          type="text"
          value={value.street}
          maxLength={120}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="e.g. 12 Rizal Street, Purok 3"
          className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}
