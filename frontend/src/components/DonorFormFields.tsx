import { AlertTriangle, Info } from "lucide-react";
import { FormField, SelectInput, TextInput } from "./ui";
import AddressSelect from "./AddressSelect";
import { PhoneInput } from "./inputs";
import { ageFromDob, ageNotice, todayLocal } from "../lib/age";
import { EMPTY_ADDRESS, type AddressValue } from "../lib/phAddress";

export interface DonorForm {
  name: string; dob: string; sex: string; contact: string; email: string;
  address: AddressValue; bloodType: string; status: string;
  physicianCleared: boolean; // staff confirm a physician evaluated a donor older than 65
}

export const EMPTY_DONOR_FORM: DonorForm = {
  name: "", dob: "", sex: "", contact: "", email: "", address: EMPTY_ADDRESS,
  bloodType: "", status: "Active", physicianCleared: false,
};

const BT_OPTS = [
  { label: "Select blood type", value: "" },
  ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({ label: b, value: b })),
];

// The reasons a donor form cannot be submitted yet (empty when it is ready).
export function donorFormProblem(f: DonorForm): string {
  if (f.name.trim().length < 2) return "Enter the donor's full name.";
  if (!f.dob) return "Choose the date of birth.";
  const age = ageFromDob(f.dob);
  if (age === null) return "The date of birth cannot be in the future.";
  if (!f.sex) return "Choose the sex.";
  if (!/^09\d{9}$/.test(f.contact)) return "Enter an 11-digit mobile number that starts with 09.";
  if (!f.address.regionCode || !f.address.provinceCode || !f.address.cityCode || !f.address.barangayCode) {
    return "Complete the address (region, province, city/municipality and barangay).";
  }
  if (!f.bloodType) return "Choose the blood type.";
  const notice = ageNotice(age);
  if (notice?.level === "blocked") return notice.message;
  if (notice?.level === "warning" && !f.physicianCleared) return "Confirm that a physician has evaluated this donor.";
  return "";
}

export default function DonorFormFields({
  form, set, statusOptions,
}: {
  form: DonorForm;
  set: <K extends keyof DonorForm>(key: K, value: DonorForm[K]) => void;
  statusOptions: { label: string; value: string }[];
}) {
  const age = ageFromDob(form.dob);
  const notice = ageNotice(age);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <FormField label="Full Name" required>
          <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Maria Luisa Santos" required />
        </FormField>
      </div>

      <div>
        <FormField label="Date of Birth" required>
          <input
            type="date"
            required
            value={form.dob}
            max={todayLocal()}
            min="1900-01-01"
            onChange={(e) => set("dob", e.target.value)}
            className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"
          />
        </FormField>
      </div>
      <div>
        <FormField label="Age">
          <div
            data-testid="age-display"
            className="w-full border border-[#E8E5E2] bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E]"
          >
            {age === null ? <span className="text-[#9CA3AF]">Calculated from date of birth</span> : `${age} years old`}
          </div>
        </FormField>
      </div>

      {notice && (
        <div
          role="status"
          data-testid="age-notice"
          className={`sm:col-span-2 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
            notice.level === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          {notice.level === "info" ? <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div>
            <p>{notice.message}</p>
            {notice.level === "warning" && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={form.physicianCleared}
                  onChange={(e) => set("physicianCleared", e.target.checked)}
                  className="w-4 h-4 accent-[#7C2D3E]"
                />
                A physician has evaluated and cleared this donor
              </label>
            )}
          </div>
        </div>
      )}

      <FormField label="Sex" required>
        <SelectInput
          value={form.sex}
          onChange={(v) => set("sex", v)}
          options={[{ label: "Select sex", value: "" }, { label: "Male", value: "Male" }, { label: "Female", value: "Female" }]}
          required
        />
      </FormField>
      <FormField label="Blood Type" required>
        <SelectInput value={form.bloodType} onChange={(v) => set("bloodType", v)} options={BT_OPTS} required />
      </FormField>

      <FormField label="Contact Number" required hint="11-digit mobile number starting with 09">
        <PhoneInput value={form.contact} onChange={(v) => set("contact", v)} required />
      </FormField>
      <FormField label="Email Address">
        <TextInput type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="donor@email.com" />
      </FormField>

      <div className="sm:col-span-2">
        <p className="text-sm font-medium text-[#1C1C2E] mb-2">Address <span className="text-[#7C2D3E]">*</span></p>
        <AddressSelect value={form.address} onChange={(a) => set("address", a)} />
      </div>

      <FormField label="Status">
        <SelectInput value={form.status} onChange={(v) => set("status", v)} options={statusOptions} />
      </FormField>
    </div>
  );
}
