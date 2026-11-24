import { Check, Circle } from "lucide-react";

export const PASSWORD_RULES = [
  { key: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "num", label: "One number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (! @ # $ % ...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const isStrongPassword = (p: string) => p.length <= 72 && PASSWORD_RULES.every((r) => r.test(p));

// Lists every password rule and ticks it as the typed password meets it.
export default function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-label="Password requirements" data-testid="password-rules">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.key} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-700" : password ? "text-red-600" : "text-[#6B7280]"}`}>
            {ok ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
