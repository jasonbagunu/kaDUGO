// Digits-only input for Philippine mobile numbers (11 digits, starting with 09).
// Letters and symbols are dropped as they are typed; pasted numbers are cleaned too.
export const PH_MOBILE_PATTERN = /^09\d{9}$/;

export function phMobileError(value: string): string {
  if (!value) return "";
  if (!/^\d*$/.test(value)) return "Use digits only.";
  if (!value.startsWith("09".slice(0, value.length))) return "Mobile numbers start with 09.";
  if (value.length < 11) return `Enter all 11 digits (${value.length}/11).`;
  return "";
}

export function PhoneInput({
  value, onChange, required, placeholder = "09xxxxxxxxx", id,
}: { value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; id?: string }) {
  const error = phMobileError(value);
  return (
    <div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={11}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
          error ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-[#E8E5E2] focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]"
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Event contact numbers may also be landlines with an area code (7-11 digits).
export function eventContactError(value: string): string {
  if (!value) return "";
  if (value.length < 7) return "Enter at least 7 digits.";
  if (value.startsWith("09") && value.length !== 11) return `Mobile numbers have 11 digits (${value.length}/11).`;
  return "";
}

export function EventContactInput({
  value, onChange, required, placeholder = "e.g. 09171234567 or 0788441234",
}: { value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  const error = eventContactError(value);
  return (
    <div>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={11}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
        className={`input-base ${error ? "!border-red-300" : ""}`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
