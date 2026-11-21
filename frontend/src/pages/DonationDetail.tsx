import { useParams, Link } from "react-router";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, FlaskConical, Droplets, User, Calendar, MapPin, Package } from "lucide-react";
import { Badge } from "../components/ui";
import { useApi } from "../lib/useApi";
import type { ApiDonation, ApiDonor, ApiEvent, ApiPreReg, ApiUnitDetail, Paged } from "../lib/api";

const LIFECYCLE = ["Donation Collected", "Blood Unit Created", "Lab Testing", "Classification", "Inventory"] as const;

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#F3F0ED] last:border-0">
      <span className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide flex-shrink-0 w-36">{label}</span>
      <span className={`text-sm text-[#1C1C2E] font-medium text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E8E5E2]">
        <div className="w-8 h-8 bg-[#FDF2F4] rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#7C2D3E]" />
        </div>
        <h3 className="font-semibold text-[#1C1C2E] text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

export default function DonationDetail() {
  const { id } = useParams();
  const donQ = useApi<{ donation: ApiDonation }>(id ? `/donations/${encodeURIComponent(id)}` : null);
  const donation = donQ.data?.donation ?? null;
  const unitQ = useApi<ApiUnitDetail>(donation?.bloodUnitId ? `/blood-units/${encodeURIComponent(donation.bloodUnitId)}` : null);
  const donorQ = useApi<{ donor: ApiDonor }>(donation ? `/donors/${encodeURIComponent(donation.donorId)}` : null);
  const eventQ = useApi<{ event: ApiEvent }>(donation?.eventId ? `/events/${encodeURIComponent(donation.eventId)}` : null);
  const preQ = useApi<Paged<ApiPreReg>>(donation?.preRegId ? `/pre-registrations?search=${encodeURIComponent(donation.preRegId)}` : null);

  if (donQ.loading && !donation) return <div className="py-24 text-center text-sm text-[#6B7280]">Loading donation...</div>;
  if (!donation) {
    return (
      <div className="py-24 text-center text-[#6B7280]">
        <Droplets className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-[#1C1C2E]">{donQ.error && !donQ.error.includes("not found") ? donQ.error : "Donation record not found"}</p>
        <Link to="/donations" className="text-sm text-[#7C2D3E] hover:underline mt-2 inline-block">← Back to Donations</Link>
      </div>
    );
  }

  const donor = donorQ.data?.donor;
  const detail = unitQ.data;
  const bloodUnit = detail?.unit ?? null;
  // The newest test record is the current result.
  const testRecord = detail?.testRecords[0] ?? null;
  const event = eventQ.data?.event ?? null;
  const preReg = preQ.data?.items.find((p) => p.id === donation.preRegId) ?? null;

  // Determine lifecycle step
  const lifeStep = (() => {
    if (!donation.bloodUnitId) return 0;
    if (!bloodUnit) return 1;
    if (bloodUnit.status === "Usable" || bloodUnit.status === "Quarantined") return 4;
    if (bloodUnit.status === "Not Usable" || bloodUnit.status === "Expired") return 4;
    if (testRecord) return 3;
    return 2; // pending testing
  })();

  const unitStatusColor = (s: string) => {
    if (s === "Usable") return "bg-green-50 border-green-200 text-green-800";
    if (s === "Quarantined") return "bg-amber-50 border-amber-200 text-amber-800";
    if (s === "Not Usable") return "bg-red-50 border-red-200 text-red-800";
    if (s === "Expired") return "bg-gray-100 border-gray-200 text-gray-600";
    return "bg-gray-50 border-gray-200 text-gray-600";
  };

  return (
    <div className="space-y-5">
      <Link to="/donations" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Donations
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">Donation Record</span>
              <Badge status={donation.status} />
            </div>
            <h1 className="text-2xl font-bold text-[#1C1C2E] font-mono" style={{ fontFamily: "Outfit, sans-serif" }}>{donation.id}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Calendar className="w-3.5 h-3.5" /> {donation.date}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span className="inline-flex items-center justify-center w-8 h-5 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{donation.bloodType}</span>
                Blood Type
              </div>
              {donation.personnel && (
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <User className="w-3.5 h-3.5" /> {donation.personnel}
                </div>
              )}
            </div>
          </div>
          {donation.bloodUnitId && <Link to={`/blood-units/${donation.bloodUnitId}`} className="text-xs text-[#7C2D3E] border border-[#7C2D3E]/30 bg-[#FDF2F4] hover:bg-[#F9E5E9] rounded-lg px-3 py-2 font-medium transition-colors flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" /> View Traceability
          </Link>}
        </div>

        {/* Lifecycle bar */}
        <div className="mt-5 pt-4 border-t border-[#E8E5E2]">
          <div className="flex items-center gap-0">
            {LIFECYCLE.map((step, i) => (
              <div key={step} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${i <= lifeStep ? "bg-[#7C2D3E] border-[#7C2D3E] text-white" : "bg-white border-[#E8E5E2] text-[#9CA3AF]"}`}>
                    {i < lifeStep ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[9px] font-semibold mt-1 text-center leading-tight ${i <= lifeStep ? "text-[#7C2D3E]" : "text-[#9CA3AF]"}`}>{step}</span>
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-3 ${i < lifeStep ? "bg-[#7C2D3E]" : "bg-[#E8E5E2]"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: detail sections */}
        <div className="lg:col-span-2 space-y-4">
          {/* Donor */}
          <Section title="Donor Information" icon={User}>
            <InfoRow label="Donor ID" value={
              <Link to={`/donors/${donation.donorId}`} className="text-[#7C2D3E] hover:underline font-mono">{donation.donorId}</Link>
            } />
            <InfoRow label="Full Name" value={
              donor ? <Link to={`/donors/${donor.id}`} className="text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline">{donor.name}</Link> : donation.donorName
            } />
            <InfoRow label="Blood Type" value={
              <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{donation.bloodType}</span>
            } />
            {donor && <>
              <InfoRow label="Contact" value={donor.contact} />
              <InfoRow label="Email" value={donor.email || "—"} />
              <InfoRow label="Total Donations" value={donor.totalDonations} />
            </>}
          </Section>

          {/* Event */}
          {event && (
            <Section title="Donation Event" icon={Calendar}>
              <InfoRow label="Event ID" value={
                <Link to={`/events/${event.id}`} className="text-[#7C2D3E] hover:underline font-mono">{event.id}</Link>
              } />
              <InfoRow label="Event Name" value={
                <Link to={`/events/${event.id}`} className="text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline text-right leading-snug">{event.name}</Link>
              } />
              <InfoRow label="Date" value={event.date} />
              <InfoRow label="Location" value={event.location} />
              <InfoRow label="Organizer" value={event.organizer} />
              {preReg && (
                <InfoRow label="Pre-Registration" value={
                  <span className="font-mono text-[#7C2D3E]">{preReg.id}</span>
                } />
              )}
            </Section>
          )}

          {/* Blood Unit */}
          <Section title="Blood Unit" icon={Package}>
            <InfoRow label="Blood Unit ID" value={
              bloodUnit
                ? <Link to={`/blood-units/${bloodUnit.id}`} className="text-[#7C2D3E] hover:underline font-mono">{bloodUnit.id}</Link>
                : <span className="text-[#9CA3AF]">Not yet created</span>
            } />
            {bloodUnit && <>
              <InfoRow label="Component" value={bloodUnit.component} />
              <InfoRow label="Collection Date" value={bloodUnit.collectionDate} />
              <InfoRow label="Expiration Date" value={bloodUnit.expirationDate} />
              <InfoRow label="Storage Location" value={
                bloodUnit.storageLocation !== "Pending"
                  ? `${bloodUnit.storageLocation}${bloodUnit.shelf !== "—" ? ` · Shelf ${bloodUnit.shelf} Pos ${bloodUnit.position}` : ""}`
                  : "Pending assignment"
              } />
              <InfoRow label="Current Status" value={<Badge status={bloodUnit.status} />} />
            </>}
          </Section>

          {/* Testing */}
          <Section title="Laboratory Testing" icon={FlaskConical}>
            {testRecord ? (
              <>
                <InfoRow label="Testing Date" value={testRecord.testingDate} />
                <InfoRow label="Tested By" value={testRecord.testedBy} />
                <InfoRow label="Screening Status" value={<Badge status={testRecord.screeningStatus} />} />
                <InfoRow label="Summary" value={testRecord.result} />
                <InfoRow label="Usability" value={<Badge status={testRecord.usabilityStatus} />} />
                <div className="pt-3 pb-2">
                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Screening Results</p>
                  <div className="space-y-1.5">
                    {testRecord.tests.map((t) => (
                      <div key={t.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${t.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          {t.passed
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
                          <span className={`font-medium ${t.passed ? "text-green-800" : "text-red-800"}`}>{t.name}</span>
                        </div>
                        <span className={`font-semibold ${t.passed ? "text-green-700" : "text-red-700"}`}>{t.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1C1C2E]">Pending Laboratory Testing</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Blood unit is awaiting screening by laboratory personnel.</p>
                <Link to="/testing" className="inline-flex items-center gap-1.5 text-xs text-[#7C2D3E] hover:underline font-medium mt-3">
                  Go to Blood Testing →
                </Link>
              </div>
            )}
          </Section>
        </div>

        {/* Right: status + summary */}
        <div className="space-y-4">
          {/* Blood Unit Status */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
            <h3 className="font-semibold text-[#1C1C2E] mb-3 text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>Blood Unit Status</h3>
            {bloodUnit ? (
              <div className={`rounded-xl border p-4 text-center ${unitStatusColor(bloodUnit.status)}`}>
                <div className="text-2xl font-bold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{bloodUnit.status}</div>
                <div className="text-xs opacity-80">{bloodUnit.lastActivityNote}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
                <p className="text-sm font-medium">No blood unit linked</p>
              </div>
            )}

            {bloodUnit?.testingStatus === "Pending" && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>This blood unit has <strong>not been tested</strong> yet. It must not be classified as usable until laboratory screening is complete.</span>
              </div>
            )}
          </div>

          {/* Pre-Registration link */}
          {preReg && (
            <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
              <h3 className="font-semibold text-[#1C1C2E] mb-3 text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>Pre-Registration</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF] font-semibold uppercase tracking-wide">Reg. ID</span>
                  <span className="font-mono text-[#7C2D3E]">{preReg.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF] font-semibold uppercase tracking-wide">Name</span>
                  <span className="font-medium text-[#1C1C2E]">{preReg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF] font-semibold uppercase tracking-wide">Status</span>
                  <Badge status={preReg.outcome} />
                </div>
                <Link to={`/events/${preReg.eventId}`} className="block text-center text-[#7C2D3E] hover:underline font-medium pt-1">
                  View Event →
                </Link>
              </div>
            </div>
          )}

          {/* Record connections */}
          <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
            <h3 className="font-semibold text-[#1C1C2E] mb-3 text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>Connected Records</h3>
            <div className="space-y-2">
              {[
                { label: "Donor", value: donation.donorId, href: `/donors/${donation.donorId}` },
                ...(donation.eventId ? [{ label: "Event", value: donation.eventId, href: `/events/${donation.eventId}` }] : []),
                ...(donation.bloodUnitId ? [{ label: "Blood Unit", value: donation.bloodUnitId, href: `/blood-units/${donation.bloodUnitId}` }] : []),
              ].map(({ label, value, href }) => (
                <Link key={label} to={href} className="flex items-center justify-between p-2.5 bg-[#F9F8F7] hover:bg-[#F0EDE9] rounded-lg transition-colors group">
                  <span className="text-xs text-[#9CA3AF] font-semibold">{label}</span>
                  <span className="text-xs font-mono text-[#7C2D3E] group-hover:underline">{value}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Notes */}
          {donation.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Notes</p>
              <p className="text-xs text-amber-700">{donation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
