import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Calendar } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { api, errorMessage, type ApiEvent } from "../lib/api";

export default function CreateEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", date: "", startTime: "", endTime: "", location: "",
    description: "", organizer: "", contact: "", registrationOpen: true, status: "Upcoming",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.endTime <= form.startTime) {
      setError("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      const { event } = await api<{ event: ApiEvent }>("/events", { method: "POST", body: form });
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link to="/events" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="p-6 border-b border-[#E8E5E2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FDF2F4] rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#7C2D3E]" />
            </div>
            <div>
              <h2 className="font-bold text-[#1C1C2E] text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Create Donation Event</h2>
              <p className="text-xs text-[#6B7280]">Fill in the details for the new blood donation event</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">{error}</div>
          )}
          <Field label="Event Name" required>
            <input type="text" placeholder="e.g. Blood Donation Drive – University of Saint Louis" value={form.name} onChange={(e) => set("name", e.target.value)} required className="input-base" />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Event Date" required>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required className="input-base" />
            </Field>
            <Field label="Start Time" required>
              <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required className="input-base" />
            </Field>
            <Field label="End Time" required>
              <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} required className="input-base" />
            </Field>
          </div>

          <Field label="Location" required>
            <input type="text" placeholder="e.g. CSU Tuguegarao Campus" value={form.location} onChange={(e) => set("location", e.target.value)} required className="input-base" />
          </Field>

          <Field label="Event Description">
            <textarea rows={3} placeholder="Provide a brief description of the event..." value={form.description} onChange={(e) => set("description", e.target.value)} className="input-base resize-none" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Organizer" required>
              <input type="text" placeholder="e.g. CVRBC" value={form.organizer} onChange={(e) => set("organizer", e.target.value)} required className="input-base" />
            </Field>
            <Field label="Contact Information" required>
              <input type="text" placeholder="e.g. 078-844-1234" value={form.contact} onChange={(e) => set("contact", e.target.value)} required className="input-base" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <SecondaryButton onClick={() => navigate("/events")}>Cancel</SecondaryButton>
          </div>
        </form>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          border: 1px solid #E8E5E2;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: #1C1C2E;
          outline: none;
          font-family: inherit;
          background: white;
        }
        .input-base:focus {
          border-color: #7C2D3E;
          box-shadow: 0 0 0 2px rgba(124, 45, 62, 0.1);
        }
        .input-base::placeholder { color: #9CA3AF; }
      `}</style>
    </div>
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
