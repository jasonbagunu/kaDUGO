import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Droplet, Phone, Mail, MapPin, Calendar, User, Lock, Eye, EyeOff, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../components/ui";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import { useApi } from "../lib/useApi";
import { ApiError, api, errorMessage, type ApiDonor, type ApiDonorDonation, type ApiDonorSensitive } from "../lib/api";
import { getRevealToken } from "../lib/reveal";

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

export default function DonorProfile() {
  const { id } = useParams();
  const { data, loading, error } = useApi<{ donor: ApiDonor; donations: ApiDonorDonation[] }>(id ? `/donors/${encodeURIComponent(id)}` : null);
  const donor = data?.donor;
  const donorDonations = data?.donations ?? [];

  // Protected details (birth date, full contact number, email, street address) stay hidden
  // until the person confirms their password; viewing them is written to the audit log.
  const [sensitive, setSensitive] = useState<ApiDonorSensitive | null>(null);
  const [askPassword, setAskPassword] = useState(false);
  const [revealError, setRevealError] = useState("");
  useEffect(() => { setSensitive(null); setRevealError(""); }, [id]);

  const reveal = async () => {
    if (!id) return;
    setRevealError("");
    try {
      const res = await api<{ sensitive: ApiDonorSensitive }>(`/donors/${encodeURIComponent(id)}/sensitive`);
      setSensitive(res.sensitive);
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") setAskPassword(true);
      else setRevealError(errorMessage(err));
    }
  };
  const startReveal = () => (getRevealToken() ? void reveal() : setAskPassword(true));

  if (!donor) {
    return (
      <div className="space-y-4">
        <Link to="/donors" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E]"><ArrowLeft className="w-4 h-4" /> Back to Donors</Link>
        {loading ? (
          <div className="py-16 text-center text-sm text-[#6B7280]">Loading donor...</div>
        ) : (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error || "Donor not found."}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/donors" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Donors
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Donor info card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center pb-5 border-b border-[#E8E5E2]">
              <div className="w-16 h-16 bg-[#FDF2F4] border-2 border-[#7C2D3E]/20 rounded-full flex items-center justify-center text-[#7C2D3E] font-bold text-2xl mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
                {donor.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <h2 className="font-bold text-[#1C1C2E] text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{donor.name}</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">{donor.id}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center justify-center w-10 h-7 bg-[#FDF2F4] text-[#7C2D3E] rounded-lg text-sm font-bold border border-[#F0D0D6]">{donor.bloodType}</span>
                <Badge status={donor.status} />
              </div>
            </div>

            {/* Info rows */}
            <div className="pt-4 space-y-3">
              {[
                { icon: User, label: "Age", value: `${donor.age} years old` },
                { icon: User, label: "Date of Birth", value: sensitive ? fmtDate(sensitive.dob) : "Hidden", locked: !sensitive },
                { icon: User, label: "Sex", value: donor.sex },
                { icon: Phone, label: "Contact", value: sensitive ? sensitive.contact : donor.contact, locked: !sensitive },
                { icon: Mail, label: "Email", value: (sensitive ? sensitive.email : donor.email) || "—", locked: !sensitive && !!donor.email },
                { icon: MapPin, label: "Address", value: (sensitive ? sensitive.address : donor.address) || "—", locked: !sensitive },
                { icon: Calendar, label: "Registered", value: donor.registrationDate },
              ].map(({ icon: Icon, label, value, locked }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-[#6B7280]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold tracking-wide">{label}</div>
                    <div className={`text-sm font-medium ${locked ? "text-[#6B7280]" : "text-[#1C1C2E]"}`}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#E8E5E2]">
              {sensitive ? (
                <button
                  type="button"
                  onClick={() => setSensitive(null)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#E8E5E2] text-sm text-[#1C1C2E] hover:bg-gray-50 cursor-pointer"
                >
                  <EyeOff className="w-4 h-4" /> Hide protected details
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startReveal}
                  data-testid="reveal-details"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#FDF2F4] border border-[#F0D0D6] text-sm font-medium text-[#7C2D3E] hover:bg-[#fbe6ea] cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> View protected details
                </button>
              )}
              <p className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] mt-2">
                <Lock className="w-3 h-3" /> Needs your password. Each view is recorded in the audit log.
              </p>
              {revealError && <p className="text-xs text-red-600 mt-1">{revealError}</p>}
            </div>
          </div>

          {/* Next eligible donation date */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5" data-testid="eligibility-card">
            <h3 className="font-semibold text-[#1C1C2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Donation Eligibility</h3>
            {donor.eligibility.eligible ? (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Eligible to donate now</div>
                  <div className="text-xs mt-0.5">
                    {donor.eligibility.lastDonationDate
                      ? `Last donation was on ${fmtDate(donor.eligibility.lastDonationDate)}; the waiting time has passed.`
                      : "No previous donation on record."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-900">
                <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Not yet eligible</div>
                  <div className="text-xs mt-0.5">{donor.eligibility.reason}</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Last Donation</div>
                <div className="text-sm text-[#1C1C2E] font-medium mt-0.5">{donor.eligibility.lastDonationDate ? fmtDate(donor.eligibility.lastDonationDate) : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Next Eligible Date</div>
                <div className="text-sm text-[#1C1C2E] font-medium mt-0.5" data-testid="next-eligible">
                  {donor.eligibility.nextEligibleDate ? fmtDate(donor.eligibility.nextEligibleDate) : "Any time"}
                </div>
              </div>
            </div>
            {donor.eligibility.intervalDays && (
              <p className="text-[11px] text-[#9CA3AF] mt-3">Waiting time after a donation: {donor.eligibility.intervalDays / 7} weeks (3 months).</p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
            <h3 className="font-semibold text-[#1C1C2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Donation Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#FDF2F4] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-[#7C2D3E]" style={{ fontFamily: "Outfit, sans-serif" }}>{donor.totalDonations}</div>
                <div className="text-xs text-[#6B7280]">Total Donations</div>
              </div>
              <div className="bg-[#F0FDF4] rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-700" style={{ fontFamily: "Outfit, sans-serif" }}>{donorDonations.filter((d) => d.status === "Completed").length}</div>
                <div className="text-xs text-[#6B7280]">Successful</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#E8E5E2]">
              <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Last Donation</div>
              <div className="text-sm text-[#1C1C2E] font-medium mt-0.5">{donor.lastDonation ?? "No donations yet"}</div>
            </div>
          </div>
        </div>

        {/* Donation history */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
            <div className="p-5 border-b border-[#E8E5E2]">
              <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Donation History</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">{donorDonations.length} donation records found</p>
            </div>

            {donorDonations.length > 0 ? (
              <div className="p-5 space-y-0">
                {donorDonations.map((don, i) => (
                  <div key={don.id} className="relative pl-8">
                    {/* Timeline line */}
                    {i < donorDonations.length - 1 && (
                      <div className="absolute left-3 top-8 bottom-0 w-px bg-[#E8E5E2]" />
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-1.5 top-2 w-3 h-3 rounded-full bg-[#7C2D3E] border-2 border-white shadow" />

                    <div className="pb-6">
                      <div className="bg-[#F9F8F7] border border-[#E8E5E2] rounded-xl p-4 hover:border-[#D0C8C2] transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-[#1C1C2E] text-sm">{don.date}</div>
                            <div className="text-xs text-[#6B7280] mt-0.5">{don.eventName ?? "Walk-in (no event)"}</div>
                          </div>
                          <Badge status={don.status} />
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-[#E8E5E2]">
                          <div>
                            <div className="text-[10px] text-[#9CA3AF] font-semibold">Donation ID</div>
                            <Link to={`/donations/${don.id}`} className="text-xs text-[#7C2D3E] hover:underline font-mono font-medium">{don.id}</Link>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#9CA3AF] font-semibold">Blood Type</div>
                            <div className="text-xs text-[#7C2D3E] font-bold">{don.bloodType}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#9CA3AF] font-semibold">Blood Unit</div>
                            {don.bloodUnitId ? (
                              <Link to={`/blood-units/${don.bloodUnitId}`} className="text-xs text-[#7C2D3E] hover:underline font-mono">{don.bloodUnitId}</Link>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">None</span>
                            )}
                          </div>
                        </div>
                        {don.notes && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{don.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Droplet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-[#6B7280] font-medium">No donation records yet</p>
                <p className="text-xs text-[#9CA3AF] mt-1">This donor has not made any donations</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PasswordConfirmModal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onConfirmed={() => { setAskPassword(false); void reveal(); }}
      />
    </div>
  );
}
