import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router";
import {
  LayoutDashboard, Users, Droplets, FlaskConical, Package,
  Calendar, BarChart3, Settings, ShieldCheck, LogOut,
  Bell, Search, ChevronRight, Droplet, Activity, PanelLeftClose, PanelLeftOpen, Menu,
  BookOpen, AlertTriangle, Clock, CalendarClock, User as UserIcon, X, ClipboardList, History, Siren, ServerCog, Info, TestTube2,
} from "lucide-react";
import { ConfirmDialog } from "./ui";
import { onLiveStatus, onTopic, startLive, stopLive, type LiveStatus } from "../lib/realtime";
import { api, type ApiDonation, type ApiDonor, type ApiEvent, type ApiInventorySummary, type ApiAuditLog, type ApiUnit, type ApiUser, type ApiPreReg, type Paged } from "../lib/api";
import { useDebounced } from "../lib/useApi";
import { clearSession, getSession, roleLabel } from "./RequireAuth";
import { SESSION_EVENT } from "../lib/session";
import type { Role } from "../data/mock";

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MEDTECH"];

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; roles: Role[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ALL_ROLES },
  { to: "/events", label: "Donation Events", icon: Calendar, roles: ALL_ROLES },
  { to: "/pre-registrations", label: "Pre-Registrations", icon: ClipboardList, roles: ALL_ROLES },
  { to: "/donors", label: "Donors", icon: Users, roles: ["ADMIN", "MEDTECH"] },
  { to: "/donations", label: "Donations", icon: Droplets, roles: ["ADMIN", "MEDTECH"] },
  { to: "/blood-units", label: "Blood Units", icon: Droplet, roles: ["ADMIN", "MEDTECH"] },
  { to: "/testing", label: "Blood Testing", icon: FlaskConical, roles: ["ADMIN", "MEDTECH"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["ADMIN", "MEDTECH"] },
  { to: "/analytics", label: "Analytics & Reports", icon: BarChart3, roles: ["ADMIN", "MEDTECH"] },
  { to: "/users", label: "Users & Access", icon: ShieldCheck, roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/audit-logs", label: "Audit Logs", icon: History, roles: ["SUPER_ADMIN"] },
  { to: "/manual", label: "User Manual", icon: BookOpen, roles: ALL_ROLES },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN"] },
];

const pageTitles: Record<string, { title: string; breadcrumbs: string[] }> = {
  "/": { title: "Dashboard", breadcrumbs: ["Dashboard"] },
  "/donors": { title: "Donors", breadcrumbs: ["Donors"] },
  "/donations": { title: "Donations", breadcrumbs: ["Donations"] },
  "/blood-units": { title: "Blood Units", breadcrumbs: ["Blood Units"] },
  "/testing": { title: "Blood Testing", breadcrumbs: ["Blood Testing"] },
  "/inventory": { title: "Inventory", breadcrumbs: ["Inventory"] },
  "/manual": { title: "User Manual", breadcrumbs: ["User Manual"] },
  "/events": { title: "Donation Events", breadcrumbs: ["Donation Events"] },
  "/pre-registrations": { title: "Pre-Registrations", breadcrumbs: ["Pre-Registrations"] },
  "/analytics": { title: "Analytics & Reports", breadcrumbs: ["Analytics & Reports"] },
  "/users": { title: "Users & Access", breadcrumbs: ["Users & Access"] },
  "/audit-logs": { title: "Audit Logs", breadcrumbs: ["Audit Logs"] },
  "/settings": { title: "Settings", breadcrumbs: ["Settings"] },
  "/profile": { title: "My Profile", breadcrumbs: ["My Profile"] },
  "/access-denied": { title: "Access Denied", breadcrumbs: ["Access Denied"] },
};

function getPageInfo(pathname: string) {
  if (pathname.startsWith("/blood-units/")) return { title: "Blood Unit Traceability", breadcrumbs: ["Blood Units", "Traceability"] };
  if (pathname.startsWith("/donors/")) return { title: "Donor Profile", breadcrumbs: ["Donors", "Profile"] };
  if (pathname.startsWith("/donations/")) return { title: "Donation Detail", breadcrumbs: ["Donations", "Detail"] };
  if (pathname.startsWith("/events/create")) return { title: "Create Event", breadcrumbs: ["Donation Events", "Create"] };
  if (pathname.startsWith("/events/")) return { title: "Event Details", breadcrumbs: ["Donation Events", "Details"] };
  return pageTitles[pathname] ?? { title: "kaDUGO", breadcrumbs: [] };
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, breadcrumbs } = getPageInfo(location.pathname);
  // Re-read the session whenever it changes (for example after editing your profile)
  const [session, setSessionState] = useState(getSession());
  useEffect(() => {
    const sync = () => setSessionState(getSession());
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);
  const currentUser = { name: session?.name ?? "Unknown User", role: session?.role ?? "MEDTECH" as Role };
  const initials = currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const visibleNavItems = navItems.filter((item) => item.roles.includes(currentUser.role));

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  type NotifCategory = "emergency" | "events" | "system" | "other";
  type Notification = { id: string; category: NotifCategory; icon: typeof AlertTriangle; iconClass: string; text: string; to: string };

  const CATEGORY_META: Record<NotifCategory, { label: string; chip: string }> = {
    emergency: { label: "Emergency", chip: "bg-red-50 text-red-700 border-red-200" },
    events: { label: "Donation Events", chip: "bg-blue-50 text-blue-700 border-blue-200" },
    system: { label: "System", chip: "bg-slate-100 text-slate-700 border-slate-200" },
    other: { label: "Other", chip: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  // Super Admin has no blood-bank records, so only the categories that apply to them are listed.
  const CATEGORIES: NotifCategory[] = currentUser.role === "SUPER_ADMIN" ? ["events", "system"] : ["emergency", "events", "other"];

  // Live updates: connect while signed in, and re-read the alerts whenever the
  // server says something changed (a unit quarantined, an event added, ...).
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("off");
  const [liveTick, setLiveTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    startLive();
    const offStatus = onLiveStatus(setLiveStatus);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offTopic = onTopic("notifications", () => {
      clearTimeout(timer);
      timer = setTimeout(() => setLiveTick((t) => t + 1), 500);
    });
    return () => { offStatus(); offTopic(); clearTimeout(timer); stopLive(); };
  }, [session?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifTab, setNotifTab] = useState<"all" | NotifCategory>("all");

  // Alerts come from the live records. They are re-read whenever you move to
  // another page, so a unit quarantined a minute ago shows up without a reload.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const operational = currentUser.role !== "SUPER_ADMIN";
    (async () => {
      const list: Notification[] = [];
      try {
        const [quarantined, expiring, inventory, pendingTesting, events, inactiveUsers, failedLogins] = await Promise.all([
          operational ? api<Paged<ApiUnit>>("/blood-units?status=Quarantined&pageSize=5") : Promise.resolve(null),
          operational ? api<Paged<ApiUnit>>("/blood-units?status=Usable&expiringWithinDays=7&pageSize=5") : Promise.resolve(null),
          operational ? api<ApiInventorySummary>("/inventory/summary").catch(() => null) : Promise.resolve(null),
          operational ? api<Paged<ApiUnit>>("/blood-units?status=Pending Testing&pageSize=1").catch(() => null) : Promise.resolve(null),
          api<{ events: ApiEvent[] }>("/events?status=Upcoming&pageSize=50"),
          !operational ? api<{ total: number }>("/users?status=INACTIVE&pageSize=1").catch(() => null) : Promise.resolve(null),
          !operational ? api<Paged<ApiAuditLog>>("/audit-logs?action=Failed Login&pageSize=50").catch(() => null) : Promise.resolve(null),
        ]);

        // Emergency: things that need action now
        for (const u of quarantined?.items ?? []) {
          list.push({
            id: `quarantine-${u.id}`, category: "emergency", icon: AlertTriangle, iconClass: "text-amber-600 bg-amber-50",
            text: `Unit ${u.id} (${u.bloodType}) is quarantined${u.testingStatus === "For Confirmation" ? " pending confirmatory testing" : ""}.`,
            to: `/blood-units/${u.id}`,
          });
        }
        for (const u of expiring?.items ?? []) {
          list.push({
            id: `expiring-${u.id}`, category: "emergency", icon: Clock, iconClass: "text-red-600 bg-red-50",
            text: `Unit ${u.id} (${u.bloodType}) expires ${u.daysToExpiry === 0 ? "today" : `in ${u.daysToExpiry}d`}.`,
            to: `/blood-units/${u.id}`,
          });
        }
        for (const t of inventory?.byBloodType.filter((b) => b.isLowStock) ?? []) {
          list.push({
            id: `lowstock-${t.bloodType}`, category: "emergency", icon: Siren, iconClass: "text-red-600 bg-red-50",
            text: t.usable === 0 ? `No Blood: no usable ${t.bloodType} units in stock (minimum ${t.lowStockThreshold}).` : `Low stock: only ${t.usable} usable ${t.bloodType} unit${t.usable === 1 ? "" : "s"} (minimum ${t.lowStockThreshold}).`,
            to: "/inventory",
          });
        }

        // Donation events starting soon
        for (const e of events.events) {
          const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
          if (daysUntil >= 0 && daysUntil <= 3) {
            list.push({
              id: `event-${e.id}`, category: "events", icon: CalendarClock, iconClass: "text-blue-600 bg-blue-50",
              text: `"${e.name}" starts ${daysUntil === 0 ? "today" : `in ${daysUntil}d`}. ${e.preRegistered} pre-registered.`,
              to: `/events/${e.id}`,
            });
          }
        }

        // System (Super Admin)
        if (inactiveUsers && inactiveUsers.total > 0) {
          list.push({
            id: "inactive-users", category: "system", icon: ServerCog, iconClass: "text-slate-600 bg-slate-100",
            text: `${inactiveUsers.total} account${inactiveUsers.total === 1 ? " is" : "s are"} deactivated.`, to: "/users",
          });
        }
        const recentFails = (failedLogins?.items ?? []).filter((l) => Date.now() - new Date(l.timestamp).getTime() < 86400000).length;
        if (recentFails > 0) {
          list.push({
            id: "failed-logins", category: "system", icon: AlertTriangle, iconClass: "text-amber-600 bg-amber-50",
            text: `${recentFails} failed sign-in attempt${recentFails === 1 ? "" : "s"} in the last 24 hours.`, to: "/audit-logs",
          });
        }

        // Other announcements
        if (pendingTesting && pendingTesting.total > 0) {
          list.push({
            id: "pending-testing", category: "other", icon: TestTube2, iconClass: "text-purple-600 bg-purple-50",
            text: `${pendingTesting.total} blood unit${pendingTesting.total === 1 ? " is" : "s are"} waiting for screening.`, to: "/testing",
          });
        }
      } catch {
        // Alerts are a convenience: if they cannot load, show none.
      }
      if (!cancelled) setNotifications(list);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, session?.userId, liveTick]);

  // Read state is per user and stored in this browser only. An alert is keyed by id + text,
  // so if its content changes (e.g. the stock count) it shows up as unread again.
  const readKey = `kadugo.readNotifs.${session?.userId ?? "anon"}`;
  const [readSet, setReadSet] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem(readKey) ?? "[]")); } catch { return new Set<string>(); }
  });
  useEffect(() => {
    try { setReadSet(new Set<string>(JSON.parse(localStorage.getItem(readKey) ?? "[]"))); } catch { setReadSet(new Set<string>()); }
  }, [readKey]);
  const sig = (n: Notification) => `${n.id}|${n.text}`;
  const isRead = (n: Notification) => readSet.has(sig(n));
  const persistRead = (next: Set<string>) => {
    setReadSet(next);
    try { localStorage.setItem(readKey, JSON.stringify([...next])); } catch { /* storage unavailable: read state lasts for this session only */ }
  };
  const markRead = (list: Notification[]) => persistRead(new Set([...readSet, ...list.map(sig)]));
  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const visibleNotifs = notifTab === "all" ? notifications : notifications.filter((n) => n.category === notifTab);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // Quick search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  type SearchResult = { id: string; icon: typeof UserIcon; label: string; sublabel: string; to: string };
  type SearchGroup = { label: string; results: SearchResult[] };

  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const debouncedQuery = useDebounced(searchQuery.trim(), 250);
  const searchSeq = useRef(0);

  // Searches the live records. Only areas the current role can open are
  // searched, so a result never dead-ends at Access Denied.
  useEffect(() => {
    const q = debouncedQuery;
    const seq = ++searchSeq.current;
    if (!q) { setSearchGroups([]); return; }
    const enc = encodeURIComponent(q);
    const operational = currentUser.role !== "SUPER_ADMIN";
    (async () => {
      const manages = currentUser.role !== "MEDTECH";
      const [donors, units, donations, events, users, preRegs] = await Promise.all([
        operational ? api<Paged<ApiDonor>>(`/donors?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        operational ? api<Paged<ApiUnit>>(`/blood-units?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        operational ? api<Paged<ApiDonation>>(`/donations?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        api<{ events: ApiEvent[] }>(`/events?search=${enc}&pageSize=4`).catch(() => null),
        manages ? api<{ users: ApiUser[] }>(`/users?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        api<Paged<ApiPreReg>>(`/pre-registrations?search=${enc}&pageSize=4`).catch(() => null),
      ]);
      if (seq !== searchSeq.current) return; // a newer search has started
      const groups: SearchGroup[] = [
        { label: "Donors", results: (donors?.items ?? []).map((d) => ({ id: d.id, icon: UserIcon, label: d.name, sublabel: `${d.id} • ${d.bloodType}`, to: `/donors/${d.id}` })) },
        { label: "Blood Units", results: (units?.items ?? []).map((u) => ({ id: u.id, icon: Droplets, label: `Unit ${u.id}`, sublabel: `${u.bloodType} • ${u.status}`, to: `/blood-units/${u.id}` })) },
        { label: "Donations", results: (donations?.items ?? []).map((d) => ({ id: d.id, icon: Activity, label: `Donation ${d.id}`, sublabel: `${d.donorName} • ${d.date}`, to: `/donations/${d.id}` })) },
        { label: "Events", results: (events?.events ?? []).slice(0, 4).map((e) => ({ id: e.id, icon: Calendar, label: e.name, sublabel: `${e.date} • ${e.status}`, to: `/events/${e.id}` })) },
        { label: "Pre-Registrations", results: (preRegs?.items ?? []).map((p) => ({ id: p.id, icon: ClipboardList, label: p.name, sublabel: `${p.id} • ${p.eventName}`, to: `/pre-registrations?search=${encodeURIComponent(p.id)}` })) },
        { label: "Accounts", results: (users?.users ?? []).map((u) => ({ id: u.id, icon: ShieldCheck, label: u.name, sublabel: `@${u.username} • ${roleLabel(u.role)}`, to: `/users?search=${encodeURIComponent(u.username)}` })) },
      ].filter((g) => g.results.length > 0);
      setSearchGroups(groups);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const totalResults = searchGroups.reduce((s, g) => s + g.results.length, 0);

  const goToResult = (to: string) => {
    navigate(to);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter" && searchGroups[0]?.results[0]) {
      goToResult(searchGroups[0].results[0].to);
    }
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Logging out asks first, so a stray click does not end the session.
  const [logoutOpen, setLogoutOpen] = useState(false);
  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex h-full bg-[#F5F4F2]">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col bg-[#17100F] h-full overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? 64 : 230 }}
      >
        {/* Logo + toggle */}
        <div className="px-3 py-4 border-b border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-[#7C2D3E] rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold text-lg leading-none truncate" style={{ fontFamily: "Outfit, sans-serif" }}>kaDUGO</div>
                <div className="text-[#9CA3AF] text-[9px] leading-tight mt-0.5 whitespace-nowrap">Blood Record System</div>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-8 h-8 bg-[#7C2D3E] rounded-lg flex items-center justify-center flex-shrink-0 mx-auto">
              <Activity className="w-4 h-4 text-white" />
            </div>
          )}

          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0 ${collapsed ? "hidden" : "flex"}`}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsed: show only icons */}
        {collapsed && (
          <div className="flex flex-col items-center pt-2">
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer mb-1"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
          {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors group ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-[#7C2D3E] text-white"
                    : "text-[#9CA3AF] hover:text-white hover:bg-white/8"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user */}
        <div className={`py-3 border-t border-white/10 flex-shrink-0 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-[#7C2D3E] rounded-full flex items-center justify-center text-white text-xs font-bold" title={`${currentUser.name} — ${roleLabel(currentUser.role)}`}>{initials}</div>
              <button
                onClick={() => setLogoutOpen(true)}
                title="Log out"
                className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Link to="/profile" title="My profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 cursor-pointer">
                <div className="w-8 h-8 bg-[#7C2D3E] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{currentUser.name}</div>
                  <div className="text-[#6B7280] text-[10px]">{roleLabel(currentUser.role)}</div>
                </div>
              </Link>
              <button
                onClick={() => setLogoutOpen(true)}
                className="mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/8 text-sm w-full cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-[#E8E5E2] px-4 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile / collapsed toggle in topbar */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1C1C2E] hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                <span>CVRBC</span>
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    <span className={i === breadcrumbs.length - 1 ? "text-[#1C1C2E] font-medium" : ""}>{crumb}</span>
                  </span>
                ))}
              </div>
              <h2 className="text-base font-bold text-[#1C1C2E] truncate" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative hidden md:block" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => searchQuery && setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder={currentUser.role === "SUPER_ADMIN" ? "Quick search: accounts, events..." : "Quick search: donors, units..."}
                className="pl-9 pr-8 py-1.5 border border-[#E8E5E2] rounded-lg text-sm bg-[#F9F8F7] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] w-52 text-[#1C1C2E]"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1C1C2E] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchOpen && searchQuery && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#E8E5E2] shadow-lg z-50 overflow-hidden">
                  {totalResults === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#6B7280]">
                      No results for &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {searchGroups.map((group) => (
                        <div key={group.label}>
                          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                            {group.label}
                          </div>
                          {group.results.map((r) => {
                            const Icon = r.icon;
                            return (
                              <button
                                key={`${group.label}-${r.id}`}
                                onClick={() => goToResult(r.to)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F9F8F7] transition-colors text-left cursor-pointer"
                              >
                                <div className="p-1.5 rounded-lg bg-[#FDF2F4] text-[#7C2D3E] flex-shrink-0">
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-[#1C1C2E] truncate">{r.label}</div>
                                  <div className="text-[10px] text-[#9CA3AF] truncate">{r.sublabel}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <span
              data-testid="live-status"
              title={liveStatus === "live" ? "Live updates are on: changes appear without refreshing." : liveStatus === "off" ? "Live updates are off." : "Reconnecting to live updates..."}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                liveStatus === "live" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveStatus === "live" ? "bg-green-500" : "bg-amber-500"}`} />
              {liveStatus === "live" ? "Live" : liveStatus === "off" ? "Offline" : "Reconnecting"}
            </span>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5 text-[#6B7280]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#7C2D3E] rounded-full" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#E8E5E2] shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E5E2] flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#1C1C2E]">Notifications</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#6B7280]">{unreadCount} unread</span>
                      <button
                        type="button"
                        onClick={() => markRead(notifications)}
                        disabled={unreadCount === 0}
                        className="text-xs font-medium text-[#7C2D3E] hover:underline disabled:text-[#9CA3AF] disabled:no-underline disabled:cursor-default cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 px-3 py-2 border-b border-[#F3F0ED] overflow-x-auto" role="tablist" aria-label="Notification categories">
                    {(["all", ...CATEGORIES] as const).map((c) => {
                      const count = (c === "all" ? notifications : notifications.filter((n) => n.category === c)).filter((n) => !isRead(n)).length;
                      const active = notifTab === c;
                      return (
                        <button
                          key={c}
                          role="tab"
                          aria-selected={active}
                          onClick={() => setNotifTab(c)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border cursor-pointer transition-colors ${
                            active ? "bg-[#7C2D3E] text-white border-[#7C2D3E]" : "bg-white text-[#6B7280] border-[#E8E5E2] hover:bg-[#F9F8F7]"
                          }`}
                        >
                          {c === "all" ? "All" : CATEGORY_META[c].label} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {visibleNotifs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#6B7280]">
                        {notifTab === "all" ? "You're all caught up." : "Nothing in this category."}
                      </div>
                    ) : (
                      visibleNotifs.map((n) => {
                        const Icon = n.icon;
                        const read = isRead(n);
                        return (
                          <Link
                            key={n.id}
                            to={n.to}
                            onClick={() => { markRead([n]); setNotifOpen(false); }}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-[#F9F8F7] border-b border-[#F3F0ED] last:border-b-0 transition-colors ${read ? "opacity-60" : "bg-[#FFFBFB]"}`}
                          >
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${n.iconClass}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className={`inline-block text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border mb-1 ${CATEGORY_META[n.category].chip}`}>
                                {CATEGORY_META[n.category].label}
                              </span>
                              <div className={`text-xs text-[#1C1C2E] leading-relaxed ${read ? "" : "font-medium"}`}>{n.text}</div>
                            </div>
                            {!read && <span className="ml-auto mt-1 w-2 h-2 rounded-full bg-[#7C2D3E] flex-shrink-0" aria-label="Unread" />}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/profile"
              data-testid="profile-icon"
              aria-label="My profile"
              className="w-8 h-8 bg-[#7C2D3E] hover:bg-[#6B2535] rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-colors"
              title={`${currentUser.name} — ${roleLabel(currentUser.role)} (open my profile)`}
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel="Confirm Logout"
      />
    </div>
  );
}