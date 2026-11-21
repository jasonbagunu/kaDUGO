import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router";
import {
  LayoutDashboard, Users, Droplets, FlaskConical, Package,
  Calendar, BarChart3, Settings, ShieldCheck, LogOut,
  Bell, Search, ChevronRight, Droplet, Activity, PanelLeftClose, PanelLeftOpen, Menu,
  AlertTriangle, Clock, CalendarClock, User as UserIcon, X, ClipboardList, History,
} from "lucide-react";
import { api, type ApiDonation, type ApiDonor, type ApiEvent, type ApiUnit, type Paged } from "../lib/api";
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
  { to: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN"] },
];

const pageTitles: Record<string, { title: string; breadcrumbs: string[] }> = {
  "/": { title: "Dashboard", breadcrumbs: ["Dashboard"] },
  "/donors": { title: "Donors", breadcrumbs: ["Donors"] },
  "/donations": { title: "Donations", breadcrumbs: ["Donations"] },
  "/blood-units": { title: "Blood Units", breadcrumbs: ["Blood Units"] },
  "/testing": { title: "Blood Testing", breadcrumbs: ["Blood Testing"] },
  "/inventory": { title: "Inventory", breadcrumbs: ["Inventory"] },
  "/events": { title: "Donation Events", breadcrumbs: ["Donation Events"] },
  "/pre-registrations": { title: "Pre-Registrations", breadcrumbs: ["Pre-Registrations"] },
  "/analytics": { title: "Analytics & Reports", breadcrumbs: ["Analytics & Reports"] },
  "/users": { title: "Users & Access", breadcrumbs: ["Users & Access"] },
  "/audit-logs": { title: "Audit Logs", breadcrumbs: ["Audit Logs"] },
  "/settings": { title: "Settings", breadcrumbs: ["Settings"] },
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

  type Notification = { id: string; icon: typeof AlertTriangle; iconClass: string; text: string; to: string };

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Alerts come from the live records. They are re-read whenever you move to
  // another page, so a unit quarantined a minute ago shows up without a reload.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const operational = currentUser.role !== "SUPER_ADMIN";
    (async () => {
      const list: Notification[] = [];
      try {
        const [quarantined, expiring, events] = await Promise.all([
          operational ? api<Paged<ApiUnit>>("/blood-units?status=Quarantined&pageSize=5") : Promise.resolve(null),
          operational ? api<Paged<ApiUnit>>("/blood-units?status=Usable&expiringWithinDays=7&pageSize=5") : Promise.resolve(null),
          api<{ events: ApiEvent[] }>("/events?status=Upcoming"),
        ]);
        for (const u of quarantined?.items ?? []) {
          list.push({
            id: `quarantine-${u.id}`, icon: AlertTriangle, iconClass: "text-amber-600 bg-amber-50",
            text: `Unit ${u.id} (${u.bloodType}) is quarantined${u.testingStatus === "For Confirmation" ? " pending confirmatory testing" : ""}.`,
            to: `/blood-units/${u.id}`,
          });
        }
        for (const u of expiring?.items ?? []) {
          list.push({
            id: `expiring-${u.id}`, icon: Clock, iconClass: "text-red-600 bg-red-50",
            text: `Unit ${u.id} (${u.bloodType}) expires ${u.daysToExpiry === 0 ? "today" : `in ${u.daysToExpiry}d`}.`,
            to: `/blood-units/${u.id}`,
          });
        }
        for (const e of events.events) {
          const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
          if (daysUntil >= 0 && daysUntil <= 3) {
            list.push({
              id: `event-${e.id}`, icon: CalendarClock, iconClass: "text-blue-600 bg-blue-50",
              text: `"${e.name}" starts ${daysUntil === 0 ? "today" : `in ${daysUntil}d`}.`,
              to: `/events/${e.id}`,
            });
          }
        }
      } catch {
        // Alerts are a convenience: if they cannot load, show none.
      }
      if (!cancelled) setNotifications(list.slice(0, 8));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, session?.userId]);

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
      const [donors, units, donations, events] = await Promise.all([
        operational ? api<Paged<ApiDonor>>(`/donors?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        operational ? api<Paged<ApiUnit>>(`/blood-units?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        operational ? api<Paged<ApiDonation>>(`/donations?search=${enc}&pageSize=4`).catch(() => null) : Promise.resolve(null),
        api<{ events: ApiEvent[] }>(`/events?search=${enc}`).catch(() => null),
      ]);
      if (seq !== searchSeq.current) return; // a newer search has started
      const groups: SearchGroup[] = [
        { label: "Donors", results: (donors?.items ?? []).map((d) => ({ id: d.id, icon: UserIcon, label: d.name, sublabel: `${d.id} • ${d.bloodType}`, to: `/donors/${d.id}` })) },
        { label: "Blood Units", results: (units?.items ?? []).map((u) => ({ id: u.id, icon: Droplets, label: `Unit ${u.id}`, sublabel: `${u.bloodType} • ${u.status}`, to: `/blood-units/${u.id}` })) },
        { label: "Donations", results: (donations?.items ?? []).map((d) => ({ id: d.id, icon: Activity, label: `Donation ${d.id}`, sublabel: `${d.donorName} • ${d.date}`, to: `/donations/${d.id}` })) },
        { label: "Events", results: (events?.events ?? []).slice(0, 4).map((e) => ({ id: e.id, icon: Calendar, label: e.name, sublabel: `${e.date} • ${e.status}`, to: `/events/${e.id}` })) },
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
                onClick={handleLogout}
                title="Log out"
                className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 cursor-pointer">
                <div className="w-8 h-8 bg-[#7C2D3E] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{currentUser.name}</div>
                  <div className="text-[#6B7280] text-[10px]">{roleLabel(currentUser.role)}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
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
                placeholder="Quick search..."
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
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5 text-[#6B7280]" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#7C2D3E] rounded-full" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#E8E5E2] shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E8E5E2] flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#1C1C2E]">Notifications</span>
                    <span className="text-xs text-[#6B7280]">{notifications.length}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#6B7280]">
                        You&apos;re all caught up.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const Icon = n.icon;
                        return (
                          <Link
                            key={n.id}
                            to={n.to}
                            onClick={() => setNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F9F8F7] border-b border-[#F3F0ED] last:border-b-0 transition-colors"
                          >
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${n.iconClass}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs text-[#1C1C2E] leading-relaxed">{n.text}</span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-8 h-8 bg-[#7C2D3E] rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer" title={`${currentUser.name} — ${roleLabel(currentUser.role)}`}>{initials}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
