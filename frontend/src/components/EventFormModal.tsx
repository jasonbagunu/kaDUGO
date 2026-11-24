import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { Modal, PrimaryButton, SecondaryButton } from "./ui";
import { EventContactInput, eventContactError } from "./inputs";
import { api, errorMessage, type ApiEvent } from "../lib/api";

const EMPTY = {
  name: "", date: "", startTime: "", endTime: "", location: "", description: "", organizer: "", contact: "",
  facebookUrl: "", messengerUrl: "", contactEmail: "", otherPlatforms: "",
  registrationOpen: true, status: "Upcoming",
};
type EventForm = typeof EMPTY;

const isUrl = (v: string) => v === "" || /^https?:\/\/\S+\.\S+$/i.test(v);

// "Create Donation Event" as a pop-up. Everything from the old full page is kept, plus the
// optional communication channels. The form is emptied every time it opens and after saving.
export default function EventFormModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (event: ApiEvent) => void }) {
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setForm(EMPTY); setError(""); setSaving(false); } }, [open]);

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.endTime <= form.startTime) return setError("End time must be after start time.");
    const contactProblem = eventContactError(form.contact);
    if (contactProblem) return setError(`Contact number: ${contactProblem}`);
    if (!isUrl(form.facebookUrl)) return setError("The Facebook link must start with http:// or https://.");
    if (!isUrl(form.messengerUrl)) return setError("The Messenger link must start with http:// or https://.");
    setSaving(true);
    try {
      const { event } = await api<{ event: ApiEvent }>("/events", { method: "POST", body: form });
      setForm(EMPTY);
      onCreated(event);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Donation Event" size="lg">
      <form onSubmit={(e) => void submit(e)} className="space-y-5" autoComplete="off">
        <div className="flex items-center gap-3 -mt-1">
          <div className="w-10 h-10 bg-[#FDF2F4] rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-[#7C2D3E]" />
          </div>
          <p className="text-xs text-[#6B7280]">Fill in the details for the new blood donation event</p>
        </div>

        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>}

        <Field label="Event Name" required>
          <input type="text" maxLength={200} placeholder="e.g. Blood Donation Drive – University of Saint Louis" value={form.name} onChange={(e) => set("name", e.target.value)} required className="input-base" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Event Date" required>
            <input type="date" min="2020-01-01" max="2100-12-31" value={form.date} onChange={(e) => set("date", e.target.value)} required className="input-base" />
          </Field>
          <Field label="Start Time" required>
            <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required className="input-base" />
          </Field>
          <Field label="End Time" required>
            <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} required className="input-base" />
          </Field>
        </div>

        <Field label="Location" required>
          <input type="text" maxLength={200} placeholder="e.g. CSU Tuguegarao Campus" value={form.location} onChange={(e) => set("location", e.target.value)} required className="input-base" />
        </Field>

        <Field label="Event Description">
          <textarea rows={3} maxLength={2000} placeholder="Provide a brief description of the event..." value={form.description} onChange={(e) => set("description", e.target.value)} className="input-base resize-none" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Organizer" required>
            <input type="text" maxLength={200} placeholder="e.g. CVRBC" value={form.organizer} onChange={(e) => set("organizer", e.target.value)} required className="input-base" />
          </Field>
          <Field label="Contact Number" required>
            <EventContactInput value={form.contact} onChange={(v) => set("contact", v)} required />
          </Field>
        </div>

        <fieldset className="border border-[#E8E5E2] rounded-xl p-4 space-y-4">
          <legend className="px-2 text-sm font-semibold text-[#1C1C2E]">
            Communication channels <span className="text-xs font-normal text-[#9CA3AF]">(optional)</span>
          </legend>
          <p className="text-xs text-[#6B7280] -mt-1">Shown to donors on the registration page so they can follow announcements or reach the organizers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Facebook page or event link">
              <input type="url" maxLength={300} placeholder="https://facebook.com/..." value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} className="input-base" />
            </Field>
            <Field label="Messenger link">
              <input type="url" maxLength={300} placeholder="https://m.me/..." value={form.messengerUrl} onChange={(e) => set("messengerUrl", e.target.value)} className="input-base" />
            </Field>
            <Field label="Contact email">
              <input type="email" maxLength={150} placeholder="events@example.com" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className="input-base" />
            </Field>
            <Field label="Other platforms">
              <input type="text" maxLength={300} placeholder="e.g. Viber group, Instagram @handle" value={form.otherPlatforms} onChange={(e) => set("otherPlatforms", e.target.value)} className="input-base" />
            </Field>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Event Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="input-base cursor-pointer">
              <option>Upcoming</option>
              <option>Ongoing</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </Field>
          <Field label="Registration Availability">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} className="w-4 h-4 accent-[#7C2D3E] rounded" />
              <span className="text-sm text-[#1C1C2E]">Enable public registration</span>
            </label>
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Creating..." : "Create Event"}</PrimaryButton>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        </div>
      </form>

      <style>{`
        .input-base { width: 100%; border: 1px solid #E8E5E2; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: #1C1C2E; outline: none; font-family: inherit; background: white; }
        .input-base:focus { border-color: #7C2D3E; box-shadow: 0 0 0 2px rgba(124, 45, 62, 0.1); }
        .input-base::placeholder { color: #9CA3AF; }
      `}</style>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">
        {label} {required && <span className="text-[#7C2D3E]">*</span>}
      </label>
      {children}
    </div>
  );
}
