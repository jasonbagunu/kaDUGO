import { useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Calendar, MapPin, Users, Droplets, Clock, Share2, Copy, QrCode, ExternalLink, Settings2 } from "lucide-react";
import { Badge, KPICard, Modal, Toast, FormField, SelectInput, PrimaryButton, SecondaryButton } from "../components/ui";
import PreRegActions from "../components/PreRegActions";
import { useData } from "../context/DataContext";
import { api, errorMessage, type ApiEvent, type ApiPreReg, type ApiDonation, type ApiDonor, type Paged } from "../lib/api";
import { getSession } from "../lib/session";
import { useApi } from "../lib/useApi";

type Tab = "Overview" | "Pre-Registrations" | "Donors" | "Donations" | "Blood Units" | "Analytics";

export default function EventDetail() {
  const { id } = useParams();
  const { toast, showToast } = useData();
  const role = getSession()?.role;
  // Super Admin schedules events and sees sign-ups, but not medical records.
  const staff = role === "ADMIN" || role === "MEDTECH";
  const tabs: Tab[] = staff
    ? ["Overview", "Pre-Registrations", "Donors", "Donations", "Blood Units", "Analytics"]
    : ["Overview", "Pre-Registrations"];

  const eventQ = useApi<{ event: ApiEvent }>(id ? `/events/${encodeURIComponent(id)}` : null);
  const preQ = useApi<Paged<ApiPreReg>>(id ? `/pre-registrations?eventId=${encodeURIComponent(id)}&pageSize=500` : null);
  const donQ = useApi<Paged<ApiDonation>>(staff && id ? `/donations?eventId=${encodeURIComponent(id)}&pageSize=500` : null);
  const donorQ = useApi<Paged<ApiDonor>>(staff ? "/donors?pageSize=500" : null);

  const event = eventQ.data?.event ?? null;
  const eventPreRegs = preQ.data?.items ?? [];
  const eventDonations = donQ.data?.items ?? [];
  const donorsById = new Map((donorQ.data?.items ?? []).map((d) => [d.id, d]));

  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mStatus, setMStatus] = useState("Upcoming");
  const [mOpen, setMOpen] = useState("open");
  const [mSaving, setMSaving] = useState(false);
  const [mError, setMError] = useState("");

  const refreshAll = async () => {
    await Promise.all([eventQ.reload(), preQ.reload(), staff ? donQ.reload() : Promise.resolve(), staff ? donorQ.reload() : Promise.resolve()]);
  };

  if (eventQ.loading && !event) return <div className="py-16 text-center text-sm text-[#6B7280]">Loading event...</div>;
  if (!event) {
    return (
      <div className="space-y-4">
        <Link to="/events" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E]"><ArrowLeft className="w-4 h-4" /> Back to Events</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{eventQ.error || "Event not found."}</div>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/register/${event.publicToken}`;
  const linkLive = event.registrationOpen && (event.status === "Upcoming" || event.status === "Ongoing");

  const handleCopy = () => {
    void navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openManage = () => {
    setMStatus(event.status);
    setMOpen(event.registrationOpen ? "open" : "closed");
    setMError("");
    setManageOpen(true);
  };

  const saveManage = async () => {
    setMSaving(true);
    setMError("");
    try {
      await api(`/events/${event.id}`, { method: "PATCH", body: { status: mStatus, registrationOpen: mOpen === "open" } });
      setManageOpen(false);
      await eventQ.reload();
      showToast("Event updated.");
    } catch (e) {
      setMError(errorMessage(e));
    } finally {
      setMSaving(false);
    }
  };

  // Donors tab: people from this event who have a donor record
  const eventDonors = eventPreRegs
    .filter((p) => p.donorId && donorsById.has(p.donorId))
    .map((p) => ({ preReg: p, donor: donorsById.get(p.donorId!)! }));
  const eventUnits = eventDonations.filter((d) => d.bloodUnit);
  const donatedCount = eventPreRegs.filter((p) => p.outcome === "Donated").length;

  return (
    <div className="space-y-5">
      <Link to="/events" className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1C1C2E] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge status={event.status} />
              {event.registrationOpen && (
                <span className="text-[10px] bg-[#FDF2F4] text-[#7C2D3E] border border-[#F0D0D6] rounded-full px-2 py-0.5 font-medium">Registration Open</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{event.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Calendar className="w-3.5 h-3.5" /> {event.date} · {event.startTime} – {event.endTime}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <MapPin className="w-3.5 h-3.5" /> {event.location}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <Users className="w-3.5 h-3.5" /> {event.organizer}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openManage} className="flex items-center gap-1.5 text-sm text-[#6B7280] border border-[#E8E5E2] hover:bg-gray-50 rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer">
              <Settings2 className="w-3.5 h-3.5" /> Manage Event
            </button>
            {linkLive && (
              <Link to={`/register/${event.publicToken}`} className="flex items-center gap-1.5 text-sm text-[#7C2D3E] border border-[#7C2D3E]/30 bg-[#FDF2F4] hover:bg-[#F9E5E9] rounded-lg px-3 py-2 font-medium transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Preview Page
              </Link>
            )}
          </div>
        </div>

        {!linkLive && (
          <div className="mt-4 pt-4 border-t border-[#E8E5E2] text-xs text-[#6B7280]">
            Public registration is closed for this event. Use <strong>Manage Event</strong> to reopen it.
          </div>
        )}
        {linkLive && (
          <div className="mt-4 pt-4 border-t border-[#E8E5E2]">
            <p className="text-xs text-[#6B7280] font-semibold mb-2">Public Registration Link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#F9F8F7] border border-[#E8E5E2] rounded-lg px-3 py-2">
                <Share2 className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                <span className="text-xs text-[#6B7280] font-mono truncate">{publicUrl}</span>
              </div>
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs bg-[#7C2D3E] hover:bg-[#6B2535] text-white rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer">
                <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 text-xs border border-[#E8E5E2] hover:bg-gray-50 text-[#6B7280] rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer">
                <QrCode className="w-3.5 h-3.5" /> QR Code
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPIs — derived from actual records, not cached counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Pre-Registered" value={event.preRegistered} icon={<Users className="w-5 h-5 text-blue-700" />} iconBg="bg-blue-50" />
        <KPICard title="Arrived" value={event.arrived} icon={<Users className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" />
        <KPICard title="Donated" value={donatedCount} icon={<Users className="w-5 h-5 text-green-700" />} iconBg="bg-green-50" />
        <KPICard title="Donations" value={event.donations} icon={<Droplets className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" />
        <KPICard title="Blood Units" value={event.bloodUnits} icon={<Clock className="w-5 h-5 text-purple-700" />} iconBg="bg-purple-50" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="flex overflow-x-auto border-b border-[#E8E5E2]">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                tab === t ? "border-[#7C2D3E] text-[#7C2D3E]" : "border-transparent text-[#6B7280] hover:text-[#1C1C2E]"
              }`}
            >
              {t}
              {t === "Pre-Registrations" && eventPreRegs.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-[#FDF2F4] text-[#7C2D3E] rounded-full px-1.5 py-0.5">{eventPreRegs.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "Overview" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-[#1C1C2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Event Description</h3>
                <p className="text-sm text-[#6B7280]">{event.description || "No description provided."}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide mb-1">Organizer</div>
                  <div className="text-sm text-[#1C1C2E] font-medium">{event.organizer}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide mb-1">Contact</div>
                  <div className="text-sm text-[#1C1C2E] font-medium">{event.contact}</div>
                </div>
              </div>
              {event.arrived > 0 && (
                <div>
                  <div className="text-xs text-[#6B7280] mb-1">Conversion Rate (donations / arrived)</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7C2D3E] rounded-full" style={{ width: `${Math.round((event.donations / event.arrived) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-[#1C1C2E]">{Math.round((event.donations / event.arrived) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "Pre-Registrations" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#6B7280]">{eventPreRegs.length} pre-registered participants{preQ.loading && !preQ.data ? " (loading...)" : ""}</p>
                <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Donated
                  <span className="w-2 h-2 rounded-full bg-blue-500 ml-2" /> Pre-registered
                  <span className="w-2 h-2 rounded-full bg-red-400 ml-2" /> Did Not Donate
                </div>
              </div>
              {eventPreRegs.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280]">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No pre-registrations yet</p>
                  <p className="text-sm mt-1">Share the public registration link to receive sign-ups.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E5E2]">
                        {["Reg. ID", "Name", "Contact", "Blood Type", "Reg. Date", "Attendance", "Donation", "Actions"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F0ED]">
                      {eventPreRegs.map((r) => (
                        <tr key={r.id} className="hover:bg-[#F9F8F7] transition-colors">
                          <td className="py-3 px-4 text-xs font-mono text-[#6B7280]">{r.id}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-[#1C1C2E]">{r.name}</div>
                            {r.donorId && (
                              <Link to={`/donors/${r.donorId}`} className="text-[10px] font-mono text-[#7C2D3E] hover:underline">{r.donorId}</Link>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6B7280]">{r.contact}</td>
                          <td className="py-3 px-4">
                            {r.bloodType ? (
                              <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{r.bloodType}</span>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6B7280]">{r.date}</td>
                          <td className="py-3 px-4"><Badge status={r.attendance} /></td>
                          <td className="py-3 px-4"><Badge status={r.outcome} /></td>
                          <td className="py-3 px-4">
                            <PreRegActions preReg={r} onChanged={refreshAll} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "Donors" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#6B7280]">
                  {eventDonors.length} registered donor{eventDonors.length !== 1 ? "s" : ""} linked to this event
                </p>
              </div>
              {eventDonors.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280]">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No donors linked yet</p>
                  <p className="text-sm mt-1">Donors appear here when registered with this event selected, or when a pre-registrant is linked to an existing donor record.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E5E2]">
                        {["Donor ID", "Name", "Blood Type", "Contact", "Total Donations", "Attendance", "Donation Status", "Actions"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F0ED]">
                      {eventDonors.map(({ preReg, donor }) => (
                        <tr key={donor.id} className="hover:bg-[#F9F8F7] transition-colors">
                          <td className="py-3 px-4 text-xs font-mono text-[#6B7280]">{donor.id}</td>
                          <td className="py-3 px-4">
                            <Link to={`/donors/${donor.id}`} className="font-medium text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline">{donor.name}</Link>
                            <div className="text-xs text-[#9CA3AF]">{donor.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{donor.bloodType}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6B7280]">{donor.contact}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-semibold text-[#1C1C2E]">{donor.totalDonations}</span>
                          </td>
                          <td className="py-3 px-4"><Badge status={preReg.attendance} /></td>
                          <td className="py-3 px-4"><Badge status={preReg.outcome} /></td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Link to={`/donors/${donor.id}`} className="text-xs text-[#7C2D3E] hover:underline font-medium">View Profile</Link>
                              <PreRegActions preReg={preReg} onChanged={refreshAll} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "Donations" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#6B7280]">
                  {eventDonations.length} donation record{eventDonations.length !== 1 ? "s" : ""} collected in this event
                </p>
              </div>
              {eventDonations.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280]">
                  <Droplets className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No donations recorded yet</p>
                  <p className="text-sm mt-1">Donations appear here when a pre-registrant is marked as Donated, or when a donation is manually linked to this event.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E5E2]">
                        {["Donation ID", "Donor", "Blood Type", "Date", "Status", "Blood Unit ID", "Actions"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F0ED]">
                      {eventDonations.map((don) => (
                        <tr key={don.id} className="hover:bg-[#F9F8F7] transition-colors">
                          <td className="py-3 px-4 text-xs font-mono text-[#7C2D3E] font-medium">{don.id}</td>
                          <td className="py-3 px-4">
                            <Link to={`/donors/${don.donorId}`} className="font-medium text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline">{don.donorName}</Link>
                            <div className="text-xs font-mono text-[#9CA3AF]">{don.donorId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{don.bloodType}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6B7280]">{don.date}</td>
                          <td className="py-3 px-4"><Badge status={don.status} /></td>
                          <td className="py-3 px-4">
                            {don.bloodUnitId ? (
                              <Link to={`/blood-units/${don.bloodUnitId}`} className="text-xs font-mono text-[#7C2D3E] hover:underline">{don.bloodUnitId}</Link>
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Link to={`/donations/${don.id}`} className="text-xs text-[#7C2D3E] hover:underline font-medium">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "Blood Units" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#6B7280]">{eventUnits.length} blood unit{eventUnits.length !== 1 ? "s" : ""} collected in this event</p>
              </div>
              {eventUnits.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280]">
                  <Droplets className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No blood units yet</p>
                  <p className="text-sm mt-1">Blood units are auto-created when a donation is recorded.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E5E2]">
                        {["Blood Unit ID", "Donation ID", "Donor", "Blood Type", "Testing", "Status", "Collection Date"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F0ED]">
                      {eventUnits.map((d) => (
                        <tr key={d.id} className="hover:bg-[#F9F8F7] transition-colors">
                          <td className="py-3 px-4"><Link to={`/blood-units/${d.bloodUnit!.id}`} className="text-xs font-mono text-[#7C2D3E] hover:underline font-medium">{d.bloodUnit!.id}</Link></td>
                          <td className="py-3 px-4"><Link to={`/donations/${d.id}`} className="text-xs font-mono text-[#7C2D3E] hover:underline">{d.id}</Link></td>
                          <td className="py-3 px-4"><Link to={`/donors/${d.donorId}`} className="text-sm text-[#1C1C2E] hover:text-[#7C2D3E] hover:underline font-medium">{d.donorName}</Link></td>
                          <td className="py-3 px-4"><span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{d.bloodType}</span></td>
                          <td className="py-3 px-4"><Badge status={d.bloodUnit!.testingStatus} /></td>
                          <td className="py-3 px-4"><Badge status={d.bloodUnit!.status} /></td>
                          <td className="py-3 px-4 text-xs text-[#6B7280]">{d.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "Analytics" && (
            <div className="py-12 text-center text-[#6B7280]">
              <div className="text-3xl mb-2">📊</div>
              <p className="font-medium">Event Analytics</p>
              <p className="text-sm mt-1">
                Pre-Registered: {event.preRegistered} · Arrived: {event.arrived} · Donated: {donatedCount} · Donations: {event.donations} · Blood Units: {event.bloodUnits}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manage event modal */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage Event" size="sm">
        <div className="space-y-4">
          {mError && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{mError}</div>}
          <FormField label="Event Status">
            <SelectInput value={mStatus} onChange={setMStatus} options={["Upcoming", "Ongoing", "Completed", "Cancelled"].map((v) => ({ label: v, value: v }))} />
          </FormField>
          <FormField label="Public Registration" hint="Closing registration stops new sign-ups through the public link.">
            <SelectInput value={mOpen} onChange={setMOpen} options={[{ label: "Open", value: "open" }, { label: "Closed", value: "closed" }]} />
          </FormField>
          <div className="flex items-center gap-3 pt-4 border-t border-[#E8E5E2]">
            <PrimaryButton onClick={() => void saveManage()} disabled={mSaving}>{mSaving ? "Saving..." : "Save Changes"}</PrimaryButton>
            <SecondaryButton onClick={() => setManageOpen(false)}>Cancel</SecondaryButton>
          </div>
        </div>
      </Modal>

      {/* QR Code modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Public Registration QR Code" size="sm">
        <div className="text-center">
          <div className="inline-block p-4 bg-white border border-[#E8E5E2] rounded-xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`}
              alt="QR code for event registration link"
              width={220}
              height={220}
            />
          </div>
          <p className="text-xs text-[#6B7280] mt-4 leading-relaxed">
            Donors can scan this code to open the pre-registration form for <strong>{event.name}</strong>.
          </p>
          <p className="text-xs text-[#9CA3AF] font-mono mt-1 break-all">{publicUrl}</p>
          <div className="mt-5">
            <SecondaryButton onClick={() => setQrOpen(false)} className="w-full justify-center">Close</SecondaryButton>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
