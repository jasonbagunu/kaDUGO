import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Search, Users, Droplets, FlaskConical, Droplet, Package, BarChart3, FileText, Rocket,
  Calendar, ShieldCheck, History, Lightbulb, ChevronRight, Info, type LucideIcon,
} from "lucide-react";
import { PageHeader, SearchInput } from "../components/ui";
import { getSession } from "../lib/session";
import type { Role } from "../data/mock";

/**
 * In-app User Manual. Every step below describes a feature that exists in kaDUGO;
 * sections are filtered to the pages the signed-in role can actually open.
 */
type Section = {
  id: string; title: string; icon: LucideIcon; roles: Role[]; to?: string; img?: string;
  intro: string; steps?: string[]; tips?: string[]; subs?: { title: string; steps: string[] }[];
};
const STAFF: Role[] = ["ADMIN", "MEDTECH"];
const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "MEDTECH"];

const SECTIONS: Section[] = [
  {
    id: "start", title: "Getting Started", icon: Rocket, roles: ALL, to: "/", img: "dashboard",
    intro: "Sign in, find your way around and keep your account safe.",
    steps: [
      "Open kaDUGO, type your **username** and **password**, then click **Sign In**.",
      "Use the **sidebar** on the left to open pages. It only shows the pages your role may use.",
      "Use the **search box** at the top to jump to a donor, blood unit, donation, event or pre-registration (Super Admin: accounts, events and pre-registrations).",
      "Click the **bell** for alerts (Emergency, Donation Events, System, Other). Click an alert to open the record.",
      "Click the **round profile icon** to change your name, email or password. A new password needs 8+ characters with uppercase, lowercase, number and special character.",
      "Click **Log out** at the bottom of the sidebar, then **Confirm Logout**.",
    ],
    tips: [
      "Lists, counts and notifications refresh by themselves when a colleague saves a change. The **Live** badge shows this is working.",
      "A blood type with **no usable units** shows **No Blood** instead of 0 on the Dashboard and Inventory pages.",
    ],
  },
  {
    id: "donors", title: "Donor Records", icon: Users, roles: STAFF, to: "/donors", img: "donors",
    intro: "Register donors, keep their details correct and check if they can donate.",
    subs: [
      { title: "Add a donor by typing", steps: [
        "Open **Donors** and click **Add Donor** (keep **Type details manually**).",
        "Enter the **full name** and **date of birth**. Age fills in automatically.",
        "Choose **sex** and **blood type**, enter the **contact number** (11 digits starting with 09) and pick the **address** from the Region, Province, City and Barangay lists.",
        "Click save. If the system warns about a possible duplicate, click **Open record** to use the existing donor.",
      ]},
      { title: "Add a donor from a pre-registration", steps: [
        "Click **Add Donor**, then the **From a pre-registration** tab.",
        "Search the person, click them, and choose a blood type if none was given.",
        "Click **Register as Donor**. Their details are copied into the donor record.",
      ]},
      { title: "View protected details", steps: [
        "Open the donor, then click **View protected details** (or the pencil to edit).",
        "Type **your own password** and confirm. The birth date, full contact and address show for a few minutes. The view is logged.",
      ]},
    ],
    tips: [
      "Allowed ages are 16 to 65. Under 18 needs parental consent; over 65 needs physician clearance (tick the box).",
      "A donor can donate again 84 days after the last completed donation. The **Donation Eligibility** card shows the next date.",
      "Only an Admin can remove a donor. A donor with donations cannot be removed; set the status to **Inactive**.",
    ],
  },
  {
    id: "donations", title: "Donation Records", icon: Droplets, roles: STAFF, to: "/donations", img: "donations",
    intro: "Record every collection. A blood unit is created automatically for each donation.",
    steps: [
      "Open **Donations** and click **Add Donation Record**.",
      "Choose the **donor** (blood type fills in), the **event** if any, the **donation date**, **blood type** and **donation type** (Whole Blood, Packed RBC, Fresh Frozen Plasma or Platelet Concentrate).",
      "Add personnel and notes if needed, then click **Save Donation Record**.",
      "Click the donation ID or arrow icon to see the donor, event, blood unit and test results together.",
    ],
    tips: [
      "The system blocks a donation if the donor already has one for the same event or has not reached the next eligible date.",
      "To release a **Usable** unit, click **Issued**, type who it goes to and confirm. For **Not Usable** or **Expired** units, click **Dispose**.",
    ],
  },
  {
    id: "testing", title: "Blood Testing Records", icon: FlaskConical, roles: STAFF, to: "/testing", img: "testing",
    intro: "Every unit must be screened before use. Results are entered by hand.",
    steps: [
      "Open **Blood Testing**. The **Pending Testing** tab lists units waiting for screening.",
      "Click **Record Result** beside a unit (or **Record Test Result** at the top).",
      "Check the **blood unit** and **testing date**. **Tested By** is filled from your login.",
      "Mark each required test (HBsAg, Anti-HCV, HIV, Syphilis, Malaria) as **Reactive** or **Non-Reactive**.",
      "Click **Save Test Result**. The **Results Recorded** tab keeps the history.",
    ],
    tips: [
      "All non-reactive: the unit becomes **Usable**.",
      "Any reactive: the unit is **Quarantined** and marked **For Confirmation**. A reactive confirmatory result makes it **Not Usable**; a non-reactive one clears it to **Usable**.",
    ],
  },
  {
    id: "traceability", title: "Blood Unit Traceability", icon: Droplet, roles: STAFF, to: "/blood-units", img: "traceability",
    intro: "Follow a unit from the donor to its issue or disposal.",
    steps: [
      "Open **Blood Units** and search by unit ID, or use the blood type, component and status filters.",
      "Click the unit (or the eye icon) to open its **traceability** page.",
      "Read the stages from top to bottom: **Collection** (donor, event, component), **Testing & Screening**, **Processing**, **Storage** and **Current Status**.",
      "To update the storage location, shelf, position or status, click the pencil icon, write a **reason** and save.",
    ],
    tips: ["Units that are Issued, Not Usable or Expired are final and cannot be changed."],
  },
  {
    id: "inventory", title: "Inventory Management", icon: Package, roles: STAFF, to: "/inventory", img: "inventory",
    intro: "See what blood is available now and what needs attention.",
    steps: [
      "Open **Inventory**. The top tiles show total **Usable**, **Quarantined**, **Not Usable** and **Expiring Soon** units.",
      "Check **Inventory by Blood Type**. Each card shows usable units, a stock bar and warnings.",
      "Use the search box and filters (blood type, status) in the unit list. Click **View** to open a unit.",
    ],
    tips: [
      "**No Blood** means there are zero usable units of that type.",
      "**LOW STOCK** appears when usable units fall under the minimum for that blood type. **Expiring** means within 7 days.",
    ],
  },
  {
    id: "analytics", title: "Inventory Analytics", icon: BarChart3, roles: STAFF, to: "/analytics", img: "analytics",
    intro: "Charts for donations, inventory, testing and events.",
    steps: [
      "Open **Analytics & Reports** and choose the period (for example **Last 6 Months**).",
      "Read **Donation Analytics**, **Inventory by Blood Type**, **Testing Analytics** and **Event Analytics**. Hover over a bar or slice to see its value.",
    ],
  },
  {
    id: "reports", title: "Report Generation", icon: FileText, roles: STAFF, to: "/analytics",
    intro: "Download the analytics for printing or sharing. Reports follow the period you picked.",
    steps: [
      "On **Analytics & Reports**, choose the period first.",
      "Click **Generate Report** for a PDF report with a summary and tables.",
      "Click **Export PDF** for the data tables only, in the same layout.",
      "Click **Export Excel** for one landscape worksheet with all tables side by side. It prints on a single page width.",
    ],
    tips: ["Blood types with zero usable units appear as **No Blood** in the reports too."],
  },
  {
    id: "events", title: "Events & Pre-Registrations", icon: Calendar, roles: ALL, to: "/events",
    intro: "Schedule donation drives and follow who signed up.",
    steps: [
      "Open **Donation Events** and click **Create Event**. Fill in name, date, times, location, organizer and contact number.",
      "Open an event to copy its **public registration link** or **QR Code** for donors.",
      "On **Pre-Registrations**, search or filter people. On the day, click **Update Status** and choose **Arrived** or **Did Not Arrive**.",
      "Admin and MedTech: click **Register Donor** for someone who arrived and is not yet a donor.",
    ],
  },
  {
    id: "users", title: "Users & Access", icon: ShieldCheck, roles: ["SUPER_ADMIN", "ADMIN"], to: "/users", img: "users",
    intro: "Create and manage staff accounts. Super Admin manages Admin and MedTech; Admin manages MedTech.",
    steps: [
      "Open **Users & Access** and click **Add User**.",
      "Enter the full name, username, email, role and a strong password. Taken usernames or emails are flagged as you type.",
      "Use the pencil icon to edit an account and the shield icon to deactivate or activate it.",
    ],
  },
  {
    id: "audit", title: "Audit Logs & Backup", icon: History, roles: ["SUPER_ADMIN"], to: "/audit-logs", img: "audit",
    intro: "Review activity and download a backup.",
    steps: [
      "Open **Audit Logs**. Search by user, action or details, or use the **All Actions** list.",
      "Open **Settings**, then **Backup & Restore**, and click **Export Full Backup** to download the data. Keep the file safe.",
    ],
    tips: ["Restore is not available in the app yet. Log entries cannot be edited or deleted."],
  },
];

const B = (t: string) => t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((s, i) =>
  s.startsWith("**") ? <strong key={i} className="text-[#1C1C2E] font-semibold">{s.slice(2, -2)}</strong> : <span key={i}>{s}</span>);

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm text-[#4B5563] leading-relaxed">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#7C2D3E] text-white text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
          <span>{B(t)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function UserManual() {
  const role = (getSession()?.role ?? "MEDTECH") as Role;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string>("start");

  const visible = useMemo(() => {
    const k = q.trim().toLowerCase();
    return SECTIONS.filter((s) => s.roles.includes(role)).filter((s) =>
      !k || JSON.stringify([s.title, s.intro, s.steps, s.tips, s.subs]).toLowerCase().includes(k));
  }, [q, role]);

  const scrollTo = (id: string) => { setOpen(id); document.getElementById(`m-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <div className="space-y-6">
      <PageHeader title="User Manual" subtitle="Step-by-step guide to the kaDUGO features available to your role" />

      <div className="flex items-start gap-3 bg-[#FDF2F4] border border-[#F0D0D6] rounded-xl px-4 py-3 text-sm text-[#7C2D3E]">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Showing the guide for <strong>{role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : "MedTech"}</strong>. Sections for pages you cannot open are hidden.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
        <aside className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-3 lg:sticky lg:top-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the manual..." aria-label="Search the manual"
              className="w-full pl-9 pr-3 py-2 border border-[#E8E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] text-[#1C1C2E]" />
          </div>
          <nav className="mt-3 space-y-0.5" aria-label="Manual sections">
            {visible.map((s) => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors ${open === s.id ? "bg-[#FDF2F4] text-[#7C2D3E] font-medium" : "text-[#4B5563] hover:bg-[#F9F8F7]"}`}>
                <s.icon className="w-4 h-4 shrink-0" /> <span className="truncate">{s.title}</span>
              </button>
            ))}
            {visible.length === 0 && <p className="text-xs text-[#6B7280] px-2 py-3">No sections match your search.</p>}
          </nav>
        </aside>

        <div className="space-y-5 min-w-0">
          {visible.map((s) => (
            <section key={s.id} id={`m-${s.id}`} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5 scroll-mt-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FDF2F4] flex items-center justify-center"><s.icon className="w-5 h-5 text-[#7C2D3E]" /></div>
                  <div>
                    <h2 className="font-semibold text-[#1C1C2E] text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{s.title}</h2>
                    <p className="text-sm text-[#6B7280]">{s.intro}</p>
                  </div>
                </div>
                {s.to && <Link to={s.to} className="text-xs text-[#7C2D3E] hover:underline flex items-center gap-0.5 whitespace-nowrap mt-1">Open page <ChevronRight className="w-3 h-3" /></Link>}
              </div>
              {s.steps && <Steps items={s.steps} />}
              {s.subs?.map((sub) => (
                <div key={sub.title} className="mt-4">
                  <h3 className="text-sm font-semibold text-[#7C2D3E] mb-2">{sub.title}</h3>
                  <Steps items={sub.steps} />
                </div>
              ))}
              {s.tips && (
                <div className="mt-4 bg-[#F9F8F7] border border-[#E8E5E2] rounded-lg p-3 space-y-1.5">
                  {s.tips.map((t, i) => (
                    <p key={i} className="flex gap-2 text-xs text-[#4B5563] leading-relaxed"><Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><span>{B(t)}</span></p>
                  ))}
                </div>
              )}
              {s.img && (
                <figure className="mt-4">
                  <img src={`/manual/${s.img}.jpg`} alt={`${s.title} screen`} loading="lazy" className="w-full rounded-lg border border-[#E8E5E2]" />
                  <figcaption className="text-[11px] text-[#9CA3AF] mt-1 text-center">Example: {s.title} screen</figcaption>
                </figure>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
