import { useState } from "react";
import { Link } from "react-router";
import { Modal, FormField, SelectInput, PrimaryButton, SecondaryButton } from "./ui";
import { api, errorMessage, type ApiPreReg, type ApiDonor } from "../lib/api";
import { getSession } from "../lib/session";
import { useData } from "../context/DataContext";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Everything staff can do with one pre-registered person:
//   Update status (attendance + screening outcome) -> Register as donor -> Record donation.
// "Donated" is never picked by hand: it is set by the system when the donation is saved.
export default function PreRegActions({ preReg, onChanged }: { preReg: ApiPreReg; onChanged: () => void | Promise<void> }) {
  const { showToast } = useData();
  const role = getSession()?.role;
  const canRecord = role === "ADMIN" || role === "MEDTECH";

  const [statusOpen, setStatusOpen] = useState(false);
  const [attendance, setAttendance] = useState<string>(preReg.attendance);
  const [outcome, setOutcome] = useState<string>(preReg.outcome === "Donated" ? "—" : preReg.outcome);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [btOpen, setBtOpen] = useState(false);
  const [bloodType, setBloodType] = useState("");

  const donated = preReg.outcome === "Donated" || !!preReg.donationId;

  const openStatus = () => {
    setAttendance(preReg.attendance);
    setOutcome(preReg.outcome === "Donated" ? "—" : preReg.outcome);
    setError("");
    setStatusOpen(true);
  };

  const saveStatus = async () => {
    setSaving(true);
    setError("");
    try {
      await api(`/pre-registrations/${preReg.id}`, {
        method: "PATCH",
        body: { attendance, outcome: attendance === "Arrived" ? outcome : "—" },
      });
      setStatusOpen(false);
      await onChanged();
      showToast(`Status updated for "${preReg.name}".`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const registerDonor = async (bt?: string) => {
    setSaving(true);
    setError("");
    try {
      const { donor, created } = await api<{ donor: ApiDonor; created: boolean }>(
        `/pre-registrations/${preReg.id}/register-donor`,
        { method: "POST", body: bt ? { bloodType: bt } : {} },
      );
      setBtOpen(false);
      await onChanged();
      showToast(created ? `${preReg.name} registered as donor ${donor.id}.` : `${preReg.name} linked to existing donor ${donor.id}.`);
    } catch (e) {
      setError(errorMessage(e));
      if (!btOpen) showToast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const onRegisterClick = () => {
    if (!preReg.bloodType) {
      setBloodType("");
      setError("");
      setBtOpen(true);
    } else {
      void registerDonor();
    }
  };

  const link = "text-xs font-medium hover:underline cursor-pointer whitespace-nowrap";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button onClick={openStatus} disabled={donated} className={`${link} text-[#7C2D3E] disabled:text-[#9CA3AF] disabled:no-underline disabled:cursor-not-allowed`} title={donated ? "Already donated" : "Update status"}>
        Update Status
      </button>

      {canRecord && preReg.attendance === "Arrived" && !preReg.donorId && !donated && (
        <button onClick={onRegisterClick} disabled={saving} className={`${link} text-[#6B7280] hover:text-[#1C1C2E]`}>Register Donor</button>
      )}

      {canRecord && preReg.attendance === "Arrived" && preReg.donorId && !donated && (
        <Link
          to={`/donations?new=1&donorId=${encodeURIComponent(preReg.donorId)}&eventId=${encodeURIComponent(preReg.eventId)}&preRegId=${encodeURIComponent(preReg.id)}`}
          className={`${link} text-[#7C2D3E]`}
        >
          Record Donation
        </Link>
      )}

      {donated && preReg.donationId && canRecord && (
        <Link to={`/donations/${preReg.donationId}`} className={`${link} text-[#7C2D3E]`}>View donation</Link>
      )}

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title={`Update Status — ${preReg.name}`} size="sm">
        <div className="space-y-4">
          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <FormField label="Attendance Status">
            <SelectInput
              value={attendance}
              onChange={setAttendance}
              options={[
                { label: "Pre-registered", value: "Pre-registered" },
                { label: "Arrived", value: "Arrived" },
                { label: "Did Not Arrive", value: "Did Not Arrive" },
              ]}
            />
          </FormField>
          {attendance === "Arrived" && (
            <FormField label="Screening Outcome" hint="“Donated” is set automatically once the donation is recorded.">
              <SelectInput
                value={outcome}
                onChange={setOutcome}
                options={[
                  { label: "— (not decided yet)", value: "—" },
                  { label: "Deferred", value: "Deferred" },
                  { label: "Did Not Donate", value: "Did Not Donate" },
                ]}
              />
            </FormField>
          )}
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton onClick={() => void saveStatus()} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</PrimaryButton>
            <SecondaryButton onClick={() => setStatusOpen(false)}>Cancel</SecondaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={btOpen} onClose={() => setBtOpen(false)} title={`Blood Type — ${preReg.name}`} size="sm">
        <div className="space-y-4">
          <p className="text-xs text-[#6B7280]">This person did not know their blood type when signing up. Enter it to register them as a donor.</p>
          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <FormField label="Blood Type" required>
            <SelectInput value={bloodType} onChange={setBloodType} options={[{ label: "Select blood type", value: "" }, ...BLOOD_TYPES.map((b) => ({ label: b, value: b }))]} />
          </FormField>
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton onClick={() => bloodType && void registerDonor(bloodType)} disabled={saving || !bloodType}>{saving ? "Saving..." : "Register Donor"}</PrimaryButton>
            <SecondaryButton onClick={() => setBtOpen(false)}>Cancel</SecondaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
