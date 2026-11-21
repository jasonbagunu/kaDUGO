import React, { useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

type BadgeVariant =
  | "Usable" | "Quarantined" | "Not Usable" | "Expired"
  | "Active" | "Deferred" | "Inactive"
  | "Passed" | "Reactive" | "Pending" | "For Confirmation" | "Completed"
  | "Upcoming" | "Ongoing" | "Cancelled"
  | string;

const badgeStyles: Record<string, string> = {
  Usable: "bg-green-50 text-green-800 border border-green-200",
  Active: "bg-green-50 text-green-800 border border-green-200",
  Passed: "bg-green-50 text-green-800 border border-green-200",
  Completed: "bg-green-50 text-green-800 border border-green-200",
  Ongoing: "bg-green-50 text-green-800 border border-green-200",
  Donated: "bg-green-50 text-green-800 border border-green-200",
  Arrived: "bg-green-50 text-green-800 border border-green-200",
  Quarantined: "bg-amber-50 text-amber-800 border border-amber-200",
  "For Confirmation": "bg-amber-50 text-amber-800 border border-amber-200",
  Deferred: "bg-amber-50 text-amber-800 border border-amber-200",
  Upcoming: "bg-blue-50 text-blue-800 border border-blue-200",
  "Pre-registered": "bg-blue-50 text-blue-800 border border-blue-200",
  "Not Usable": "bg-red-50 text-red-800 border border-red-200",
  "Did Not Donate": "bg-red-50 text-red-800 border border-red-200",
  "Did Not Arrive": "bg-red-50 text-red-800 border border-red-200",
  Reactive: "bg-red-50 text-red-800 border border-red-200",
  Expired: "bg-gray-100 text-gray-600 border border-gray-200",
  Issued: "bg-blue-50 text-blue-800 border border-blue-200",
  Inactive: "bg-gray-100 text-gray-600 border border-gray-200",
  Cancelled: "bg-gray-100 text-gray-600 border border-gray-200",
  Pending: "bg-gray-100 text-gray-600 border border-gray-200",
  "—": "bg-gray-100 text-gray-400 border border-gray-200",
};

export function Badge({ status }: { status: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyles[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
      {status}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-[#E8E5E2] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h1>
        {subtitle && <p className="text-sm text-[#6B7280] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({ children, onClick, className = "", type = "button", disabled }: { children: React.ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" | "reset"; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bg-[#7C2D3E] hover:bg-[#6B2535] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, className = "", type = "button", disabled }: { children: React.ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" | "reset"; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-[#1C1C2E] border border-[#E8E5E2] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 border border-[#E8E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] w-64 text-[#1C1C2E]"
      />
    </div>
  );
}

export function Select({ value, onChange, options, className = "" }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-[#E8E5E2] rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] text-[#1C1C2E] cursor-pointer ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E8E5E2]">
            {headers.map((h) => (
              <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F3F0ED]">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3.5 px-4 text-[#1C1C2E] ${className}`}>{children}</td>;
}

export function KPICard({ title, value, icon, iconBg, sub, subColor = "text-[#6B7280]" }: {
  title: string; value: string | number; icon: React.ReactNode; iconBg: string; sub?: string; subColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-[#1C1C2E] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
          {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBg} flex-shrink-0`}>{icon}</div>
      </div>
    </div>
  );
}

/* ─── Modal ─── */
export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${widths[size]} max-h-[90vh] flex flex-col z-10 animate-in`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E5E2] flex-shrink-0">
          <h2 className="font-bold text-[#1C1C2E] text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6B7280] cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Confirm dialog ─── */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6">
        <h3 className="font-bold text-[#1C1C2E] text-base mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h3>
        <p className="text-sm text-[#6B7280] mb-5">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          {danger
            ? <DangerButton onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</DangerButton>
            : <PrimaryButton onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}

/* ─── Toast ─── */
export function Toast({ message, type = "success" }: { message: string; type?: "success" | "error" | "warning" }) {
  const styles = {
    success: { bg: "bg-green-50 border-green-300", text: "text-green-800", icon: <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" /> },
    error: { bg: "bg-red-50 border-red-300", text: "text-red-800", icon: <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" /> },
    warning: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800", icon: <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" /> },
  }[type];

  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles.bg} max-w-sm`}>
      {styles.icon}
      <span className={`text-sm font-medium ${styles.text}`}>{message}</span>
    </div>
  );
}

/* ─── FormField ─── */
export function FormField({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">
        {label}{required && <span className="text-[#7C2D3E] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#9CA3AF] mt-1">{hint}</p>}
    </div>
  );
}

/* ─── TextInput ─── */
export function TextInput({ value, onChange, placeholder, type = "text", required, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-[#6B7280]"
    />
  );
}

/* ─── SelectInput ─── */
export function SelectInput({ value, onChange, options, required, disabled }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; required?: boolean; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className="w-full border border-[#E8E5E2] rounded-lg px-3 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] cursor-pointer disabled:bg-gray-50 disabled:text-[#6B7280]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
