import { useState } from "react";
import { useParams } from "react-router";
import { Activity, Calendar, MapPin, CheckCircle, Heart, ArrowLeft, ArrowRight, AlertTriangle, Info } from "lucide-react";
import { useEffect } from "react";
import AddressSelect from "../components/AddressSelect";
import EventContactInfo from "../components/EventContactInfo";
import { PhoneInput, phMobileError } from "../components/inputs";
import { ApiError, errorMessage, type ApiPublicEvent } from "../lib/api";
import { DONOR_AGE, ageFromDob, ageNotice, todayLocal } from "../lib/age";
import { EMPTY_ADDRESS, isAddressComplete, type AddressValue } from "../lib/phAddress";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";

// Public calls need no login, so they bypass the signed-in api() helper.
async function publicCall<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Please try again in a moment.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data && typeof data.error === "string" ? data.error : `Request failed (${res.status}).`, data ?? {});
  return data as T;
}

const reminders = [
  "Must be 16-65 years old and in good health (donors under 18 need written parental or guardian consent)",
  "Weigh at least 50 kg (110 lbs)",
  "No fever, cough, or cold symptoms",
  "No recent tattoos or piercings (within 12 months)",
  "Must not have donated blood within the last 3 months (12 weeks)",
  "Bring a valid government-issued ID on the day of donation",
];

export default function PublicRegistration() {
  const { eventId: token } = useParams();
  const [event, setEvent] = useState<ApiPublicEvent | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  // The page has two steps: read about the event, then fill in the form. Going back keeps what was typed.
  const [step, setStep] = useState<"info" | "form">("info");
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicCall<{ event: ApiPublicEvent }>(`/public/events/${encodeURIComponent(token ?? "")}`)
      .then((r) => { if (!cancelled) setEvent(r.event); })
      .catch((e) => { if (!cancelled) setLoadError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const age = ageFromDob(form.dob);
    if (age === null) return setFormError("Enter a valid date of birth.");
    if (age < DONOR_AGE.min || age > DONOR_AGE.max) {
      return setFormError(`Online registration is for donors aged ${DONOR_AGE.min} to ${DONOR_AGE.max}. Please contact the blood center so a physician can assess you.`);
    }
    if (phMobileError(form.contact) || form.contact.length !== 11) return setFormError("Enter an 11-digit mobile number that starts with 09.");
    if (!isAddressComplete(form.address)) return setFormError("Complete your address: region, province, city/municipality and barangay.");
    setSubmitting(true);
    try {
      const r = await publicCall<{ reference: string; needsParentalConsent?: boolean }>(
        `/public/events/${encodeURIComponent(token ?? "")}/pre-register`, form,
      );
      setNeedsConsent(!!r.needsParentalConsent);
      setRefNum(r.reference);
      setSubmitted(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const [form, setForm] = useState<{
    name: string; dob: string; sex: string; contact: string; email: string; address: AddressValue; bloodType: string;
  }>({ name: "", dob: "", sex: "", contact: "", email: "", address: EMPTY_ADDRESS, bloodType: "" });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const age = ageFromDob(form.dob);
  const notice = ageNotice(age);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-md w-full text-center">{children}</div>
    </div>
  );

  if (loading) return shell(<p className="text-sm text-[#6B7280]">Loading event...</p>);
  if (!event) {
    return shell(
      <>
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-2xl font-bold">!</div>
        <h2 className="text-xl font-bold text-[#1C1C2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Link not valid</h2>
        <p className="text-sm text-[#6B7280]">{loadError || "This registration link is not valid."} Please check the link you were given or contact the Cagayan Valley Regional Blood Center.</p>
      </>
    );
  }
  if (!event.acceptingRegistrations && !submitted) {
    return shell(
      <>
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-700 text-2xl font-bold">!</div>
        <h2 className="text-xl font-bold text-[#1C1C2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Registration is closed</h2>
        <p className="text-sm text-[#6B7280] mb-1">{event.name}</p>
        <p className="text-sm text-[#6B7280]">Pre-registration for this event is no longer open. Contact {event.contact || "the blood center"} for help.</p>
      </>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F4F2] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#1C1C2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Registration Successful!</h2>
          <p className="text-[#6B7280] mb-6">You have been successfully pre-registered for this blood donation event.</p>

          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5 text-left mb-4">
            <div className="text-center mb-4 pb-4 border-b border-[#E8E5E2]">
              <div className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide">Registration Reference</div>
              <div className="text-2xl font-bold text-[#7C2D3E] font-mono mt-1">{refNum}</div>
            </div>
            <div className="space-y-2">
              <div><div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Event</div><div className="text-sm font-medium text-[#1C1C2E]">{event.name}</div></div>
              <div><div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Date</div><div className="text-sm font-medium text-[#1C1C2E]">{event.date} · {event.startTime} – {event.endTime}</div></div>
              <div><div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Location</div><div className="text-sm font-medium text-[#1C1C2E]">{event.location}</div></div>
            </div>
          </div>

          {needsConsent && (
            <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
              Because you are under 18, please bring written consent from a parent or guardian.
            </p>
          )}
          <p className="text-xs text-[#9CA3AF]">Please bring this reference number and a valid ID on the day of the donation event.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4F2]" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-[#17100F] text-white py-5 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-[#7C2D3E] rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-base" style={{ fontFamily: "Outfit, sans-serif" }}>kaDUGO</div>
            <div className="text-[#9CA3AF] text-xs">Cagayan Valley Regional Blood Center</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* Event info */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-[#7C2D3E]" />
            <span className="text-xs font-semibold text-[#7C2D3E] uppercase tracking-wide">Blood Donation Event Registration</span>
          </div>
          <h1 className="text-xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{event.name}</h1>
          <div className="flex flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]"><Calendar className="w-3.5 h-3.5" />{event.date} · {event.startTime} – {event.endTime}</div>
            <div className="flex items-center gap-1.5 text-xs text-[#6B7280]"><MapPin className="w-3.5 h-3.5" />{event.location}</div>
          </div>
          {event.description && <p className="text-sm text-[#6B7280] mt-3">{event.description}</p>}
          {step === "info" && <EventContactInfo event={event} className="mt-4 pt-4 border-t border-[#E8E5E2]" />}
        </div>

        {/* Reminders */}
        {step === "info" && (
        <>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-amber-800 text-sm mb-2">Important Reminders Before Donating</div>
          <ul className="space-y-1.5">
            {reminders.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setStep("form")}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#7C2D3E] hover:bg-[#6B2535] text-white py-3 rounded-lg font-semibold text-sm transition-colors cursor-pointer"
        >
          Continue to Registration <ArrowRight className="w-4 h-4" />
        </button>
        </>
        )}

        {/* Form */}
        {step === "form" && (
        <>
        <button
          type="button"
          onClick={() => setStep("info")}
          className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to event information
        </button>
        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h2 className="font-bold text-[#1C1C2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Pre-Registration Form</h2>
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-4"
          >
            {formError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{formError}</div>}
            <F label="Full Name" required><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter your full name" className="pub-input" /></F>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Date of Birth" required><input type="date" required min="1900-01-01" max={todayLocal()} value={form.dob} onChange={(e) => set("dob", e.target.value)} className="pub-input" /></F>
              <F label="Age"><div data-testid="age-display" className="pub-input !bg-gray-50">{age === null ? <span className="text-[#9CA3AF]">Calculated from date of birth</span> : `${age} years old`}</div></F>
            </div>
            {notice && (
              <div
                role="status"
                data-testid="age-notice"
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${notice.level === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}
              >
                {notice.level === "info" ? <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <p>
                  {notice.level === "info"
                    ? notice.message
                    : `${notice.message.split(".")[0]}. Online registration is only for donors aged ${DONOR_AGE.min} to ${DONOR_AGE.max}; please contact the blood center${event.contact ? ` (${event.contact})` : ""}.`}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Sex" required>
                <select required value={form.sex} onChange={(e) => set("sex", e.target.value)} className="pub-input cursor-pointer">
                  <option value="">Select sex</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </F>
              <F label="Blood Type (if known)">
                <select value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)} className="pub-input cursor-pointer">
                  <option value="">I don't know my blood type</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </F>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Contact Number" required><PhoneInput required value={form.contact} onChange={(v) => set("contact", v)} /></F>
              <F label="Email Address"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="your@email.com" className="pub-input" /></F>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C2E] mb-2">Home Address <span className="text-[#7C2D3E]">*</span></p>
              <AddressSelect value={form.address} onChange={(a) => set("address", a)} idPrefix="public" />
            </div>
            <button type="submit" disabled={submitting} className="w-full bg-[#7C2D3E] hover:bg-[#6B2535] disabled:opacity-60 text-white py-3 rounded-lg font-semibold text-sm transition-colors mt-2 cursor-pointer">
              {submitting ? "Submitting..." : "Pre-Register for Blood Donation"}
            </button>
          </form>
        </div>
        </>
        )}

        <p className="text-center text-xs text-[#9CA3AF]">
          kaDUGO — Cagayan Valley Regional Blood Center · Department of Health
        </p>
      </div>

      <style>{`
        .pub-input { width: 100%; border: 1px solid #E8E5E2; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: #1C1C2E; outline: none; font-family: inherit; background: white; }
        .pub-input:focus { border-color: #7C2D3E; box-shadow: 0 0 0 2px rgba(124,45,62,0.1); }
        .pub-input::placeholder { color: #9CA3AF; }
      `}</style>
    </div>
  );
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">{label}{required && <span className="text-[#7C2D3E] ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
