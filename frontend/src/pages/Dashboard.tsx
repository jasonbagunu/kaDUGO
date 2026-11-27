import { Link } from "react-router";
import { Users, Droplets, Package, AlertTriangle, XCircle, Clock, Calendar, ChevronRight, TrendingUp, BookOpen } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge, KPICard } from "../components/ui";
import { getSession } from "../lib/session";
import { useApi } from "../lib/useApi";
import { formatStock, isNoStock } from "../lib/stock";
import type { ApiDashboard, ApiUnit, Paged } from "../lib/api";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
type BT = typeof BLOOD_TYPES[number];

const STATUS_COLORS: Record<string, string> = {
  Usable: "#166534", Quarantined: "#B45309", "Not Usable": "#991B1B", "Pending Testing": "#6B7280", Expired: "#D1D5DB", Issued: "#1D4ED8",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const CHART_COLORS = { primary: "#7C2D3E", secondary: "#C9363A", muted: "#E8D0D4" };

export default function Dashboard() {
  const session = getSession();
  const isSuper = session?.role === "SUPER_ADMIN";
  const dash = useApi<ApiDashboard>("/dashboard");
  const recent = useApi<Paged<ApiUnit>>(isSuper ? null : "/blood-units?pageSize=6&sort=recent");
  const d = dash.data;
  const k = d?.kpis;
  const inv = d?.inventory;
  const donationTrends = d?.donationTrends ?? [];
  const unitStatusData = (d?.unitStatus ?? []).map((x) => ({ ...x, color: STATUS_COLORS[x.name] ?? "#9CA3AF" }));
  const inventoryChartData = (inv?.byBloodType ?? []).map((b) => ({ type: b.bloodType, units: b.usable }));
  const bloodUnits = recent.data?.items ?? [];
  const byType = new Map((inv?.byBloodType ?? []).map((r) => [r.bloodType, r]));
  const firstName = (session?.name ?? "").replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.)\s*/i, "").split(" ")[0];

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
      <p className="text-sm text-[#6B7280] mt-0.5">
        {isSuper ? "Here's an overview of system accounts and scheduled events." : "Here's an overview of the Regional Blood Center's blood records and inventory."}
      </p>
    </div>
    <Link to="/manual" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[#E8E5E2] bg-white text-[#7C2D3E] hover:bg-[#FDF2F4] transition-colors">
      <BookOpen className="w-4 h-4" /> User Manual
    </Link>
    </div>
  );

  if (dash.error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{dash.error}</span>
          <button onClick={() => void dash.reload()} className="font-medium underline cursor-pointer">Try again</button>
        </div>
      </div>
    );
  }
  if (!d) return <div className="space-y-6">{header}<div className="py-16 text-center text-sm text-[#6B7280]">Loading dashboard...</div></div>;

  // Super Admin: system figures only, no donor or blood data.
  if (isSuper || !k || !inv) {
    const sys = d.system;
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="System Users" value={sys?.totalUsers ?? 0} icon={<Users className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" sub={`${sys?.activeUsers ?? 0} active · ${sys?.inactiveUsers ?? 0} inactive`} />
          <KPICard title="Admin Accounts" value={sys?.admins ?? 0} icon={<Users className="w-5 h-5 text-blue-700" />} iconBg="bg-blue-50" sub="RBC Head / administrators" />
          <KPICard title="MedTech Accounts" value={sys?.medTechs ?? 0} icon={<Users className="w-5 h-5 text-purple-700" />} iconBg="bg-purple-50" sub="Laboratory personnel" />
          <KPICard title="Upcoming Events" value={d.upcomingEvents.count} icon={<Calendar className="w-5 h-5 text-blue-700" />} iconBg="bg-blue-50" sub={`Next: ${d.upcomingEvents.nextDate ?? "—"}`} subColor="text-blue-700" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { to: "/users", label: "Manage Users", desc: "Create and deactivate Admin and MedTech accounts" },
            { to: "/audit-logs", label: "Audit Logs", desc: "Review system activity" },
            { to: "/settings", label: "Settings & Backup", desc: "System settings and data export" },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5 hover:border-[#7C2D3E]/40 transition-colors">
              <div className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{c.label}</div>
              <div className="text-xs text-[#6B7280] mt-1">{c.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const totalUsable = k.usableUnits;
  const totalQuarantined = k.quarantinedUnits;
  const totalNotUsable = k.notUsableUnits;
  const totalExpiringSoon = k.expiringSoonUnits;
  const change = k.donationsChangePercent;

  return (
    <div className="space-y-6">
      {header}

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Donors" value={k.totalDonors.toLocaleString()} icon={<Users className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" sub="Registered donors" />
        <KPICard title="Donations This Month" value={k.donationsThisMonth} icon={<Droplets className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" sub={change === null ? "No earlier data to compare" : `${change >= 0 ? "+" : ""}${change}% vs same days last month`} subColor={change !== null && change < 0 ? "text-red-700" : "text-green-700"} />
        <KPICard title="Usable Blood Units" value={formatStock(totalUsable)} icon={<Package className="w-5 h-5 text-[#7C2D3E]" />} iconBg="bg-[#FDF2F4]" sub="Across all blood types" />
        <KPICard title="Units Near Expiration" value={totalExpiringSoon} icon={<Clock className="w-5 h-5 text-amber-700" />} iconBg="bg-amber-50" sub="Within 7 days" subColor="text-amber-700" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Quarantined Units" value={totalQuarantined} icon={<AlertTriangle className="w-5 h-5 text-amber-700" />} iconBg="bg-amber-50" sub={`${k.pendingTestingUnits} more awaiting first test`} subColor="text-amber-700" />
        <KPICard title="Not Usable Units" value={totalNotUsable} icon={<XCircle className="w-5 h-5 text-red-700" />} iconBg="bg-red-50" sub="Reactive or unsuitable" subColor="text-red-700" />
        <KPICard title="Expired Units" value={k.expiredUnitsThisMonth} icon={<Clock className="w-5 h-5 text-gray-500" />} iconBg="bg-gray-100" sub="This month" />
        <KPICard title="Upcoming Events" value={k.upcomingEvents} icon={<Calendar className="w-5 h-5 text-blue-700" />} iconBg="bg-blue-50" sub={`Next: ${k.nextEventDate ?? "—"}`} subColor="text-blue-700" />
      </div>

      {/* Blood Type Inventory */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Blood Type Inventory</h3>
          <Link to="/inventory" className="text-xs text-[#7C2D3E] hover:underline flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></Link>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {BLOOD_TYPES.map((bt) => {
            const data = byType.get(bt) ?? { usable: 0, expiringSoon: 0, lowStockThreshold: 1, isLowStock: false };
            const isLow = data.isLowStock;
            const pct = Math.min((data.usable / (data.lowStockThreshold * 2)) * 100, 100);
            return (
              <div key={bt} className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-4 text-center">
                <div className={`text-lg font-bold ${isLow ? "text-[#7C2D3E]" : "text-[#1C1C2E]"}`} style={{ fontFamily: "Outfit, sans-serif" }}>{bt}</div>
                <div className={`font-bold mt-1 ${isNoStock(data.usable) ? "text-sm leading-8 text-[#7C2D3E]" : "text-2xl text-[#1C1C2E]"}`} style={{ fontFamily: "Outfit, sans-serif" }}>{formatStock(data.usable)}</div>
                <div className="text-[10px] text-[#6B7280] mb-2">{isNoStock(data.usable) ? "available" : "units"}</div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isLow ? "bg-[#7C2D3E]" : "bg-green-600"}`} style={{ width: `${pct}%` }} />
                </div>
                {isLow && <div className="text-[9px] text-[#7C2D3E] mt-1.5 font-medium">LOW STOCK</div>}
                {data.expiringSoon > 0 && <div className="text-[9px] text-amber-700 mt-0.5">{data.expiringSoon} expiring</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donation Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Blood Donation Trends</h3>
              <p className="text-xs text-[#6B7280]">Monthly donations and units generated</p>
            </div>
            {d.donationTrends && change !== null && (
              <div className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${change >= 0 ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
                <TrendingUp className="w-3 h-3" /> {change >= 0 ? "+" : ""}{change}% vs last month
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={donationTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gDon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F0ED" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E5E2" }} />
              <Area type="monotone" dataKey="donations" stroke={CHART_COLORS.primary} fill="url(#gDon)" strokeWidth={2} name="Donations" />
              <Area type="monotone" dataKey="units" stroke={CHART_COLORS.secondary} fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="Units" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Unit Status donut */}
        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Blood Unit Status</h3>
          <p className="text-xs text-[#6B7280] mb-4">Current status distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={unitStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                {unitStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E5E2" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {unitStatusData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-[#6B7280]">{d.name}</span>
                </div>
                <span className="font-medium text-[#1C1C2E]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory bar chart */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory by Blood Type</h3>
        <p className="text-xs text-[#6B7280] mb-4">Usable units currently in storage</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={inventoryChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F0ED" />
            <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E5E2" }} />
            <Bar dataKey="units" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="Usable Units" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Blood Unit Activity */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-[#E8E5E2]">
          <div>
            <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Recent Blood Unit Activity</h3>
            <p className="text-xs text-[#6B7280]">Latest blood unit movements and status changes</p>
          </div>
          <Link to="/blood-units" className="text-xs text-[#7C2D3E] hover:underline flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E5E2]">
                {["Unit ID", "Blood Type", "Component", "Status", "Storage Location", "Expiration", "Last Activity"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F0ED]">
              {bloodUnits.map((u) => (
                <tr key={u.id} className="hover:bg-[#F9F8F7] transition-colors">
                  <td className="py-3 px-4">
                    <Link to={`/blood-units/${u.id}`} className="text-[#7C2D3E] font-medium hover:underline text-xs font-mono">{u.id}</Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center w-9 h-6 bg-[#FDF2F4] text-[#7C2D3E] rounded text-xs font-bold border border-[#F0D0D6]">{u.bloodType}</span>
                  </td>
                  <td className="py-3 px-4 text-[#6B7280] text-xs">{u.component}</td>
                  <td className="py-3 px-4"><Badge status={u.status} /></td>
                  <td className="py-3 px-4 text-[#6B7280] text-xs">{u.storageLocation}</td>
                  <td className="py-3 px-4 text-[#6B7280] text-xs">{u.expirationDate}</td>
                  <td className="py-3 px-4 text-[#6B7280] text-xs">{u.lastActivityNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.data && bloodUnits.length === 0 && <div className="py-8 text-center text-sm text-[#6B7280]">No blood units yet.</div>}
        </div>
      </div>
    </div>
  );
}
