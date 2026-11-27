import { useState } from "react";
import { Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { PageHeader, SecondaryButton, Toast } from "../components/ui";
import { useData } from "../context/DataContext";
import { type ApiOverview } from "../lib/api";
import { useApi } from "../lib/useApi";
import { formatStock } from "../lib/stock";
import { generateReportPDF, exportDataPDF, exportDataExcel, AnalyticsReportData } from "../lib/exportAnalytics";

const DATE_RANGE_LABELS: Record<string, string> = {
  "last-6-months": "Last 6 Months",
  "last-3-months": "Last 3 Months",
  "this-year": "This Year",
};

const STATUS_COLORS: Record<string, string> = {
  Usable: "#166534", Quarantined: "#B45309", "Not Usable": "#991B1B", "Pending Testing": "#6B7280", Expired: "#D1D5DB", Issued: "#1D4ED8",
  "Non-Reactive": "#166534", Reactive: "#991B1B", "For Confirmation": "#B45309", Pending: "#9CA3AF",
};
const colorOf = (name: string) => STATUS_COLORS[name] ?? "#9CA3AF";

export default function Analytics() {
  const { toast, showToast } = useData();
  const [dateRange, setDateRange] = useState("last-6-months");
  const [exporting, setExporting] = useState<string | null>(null);

  const { data, loading, error, reload } = useApi<ApiOverview>(`/analytics/overview?range=${dateRange}`);

  const filteredDonationTrends = data?.donationTrends ?? [];
  const trendChangePercent = data?.trend.changePercent ?? null;
  const inventoryChartData = data?.inventoryByBloodType ?? [];
  const testingOutcomeData = (data?.testingOutcomes ?? []).map((d) => ({ ...d, color: colorOf(d.name) }));
  const unitStatusData = (data?.unitStatus ?? []).map((d) => ({ ...d, color: colorOf(d.name) }));
  const usabilityData = (data?.usabilityRates ?? []).map((d) => ({ name: d.name, value: d.percent, color: colorOf(d.name) }));
  const eventPerf = (data?.eventPerformance ?? []).map((e) => ({
    name: e.name.split("–")[0].trim().slice(0, 20),
    preRegistered: e.preRegistered,
    donations: e.donations,
    units: e.bloodUnits,
  }));

  const buildReportData = (): AnalyticsReportData => ({
    dateRangeLabel: DATE_RANGE_LABELS[dateRange] ?? "All Time",
    donationTrends: filteredDonationTrends,
    inventoryByType: inventoryChartData.map((d) => ({ type: d.type, units: d.units })),
    testingOutcomes: testingOutcomeData.map((d) => ({ name: d.name, value: d.value })),
    eventPerformance: eventPerf,
    unitStatus: unitStatusData.map((d) => ({ name: d.name, value: d.value })),
    usabilityRates: usabilityData.map((d) => ({ name: d.name, value: d.value })),
  });

  const handleGenerateReport = () => {
    setExporting("report");
    try {
      generateReportPDF(buildReportData());
      showToast("Report generated and downloaded.", "success");
    } catch {
      showToast("Something went wrong generating the report.", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = () => {
    setExporting("pdf");
    try {
      exportDataPDF(buildReportData());
      showToast("Data exported to PDF.", "success");
    } catch {
      showToast("Something went wrong exporting to PDF.", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      await exportDataExcel(buildReportData());
      showToast("Data exported to Excel.", "success");
    } catch {
      showToast("Something went wrong exporting to Excel.", "error");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Data-driven insights for the Regional Blood Center"
        actions={
          <div className="flex items-center gap-2">
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="border border-[#E8E5E2] rounded-lg text-sm px-3 py-2 bg-white text-[#1C1C2E] cursor-pointer focus:outline-none">
              <option value="last-6-months">Last 6 Months</option>
              <option value="last-3-months">Last 3 Months</option>
              <option value="this-year">This Year</option>
            </select>
            <SecondaryButton onClick={handleGenerateReport} disabled={exporting !== null || !data}>
              <FileText className="w-4 h-4" /> {exporting === "report" ? "Generating..." : "Generate Report"}
            </SecondaryButton>
            <SecondaryButton onClick={handleExportPDF} disabled={exporting !== null || !data}>
              <Download className="w-4 h-4" /> {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </SecondaryButton>
            <SecondaryButton onClick={handleExportExcel} disabled={exporting !== null || !data}>
              <Download className="w-4 h-4" /> {exporting === "excel" ? "Exporting..." : "Export Excel"}
            </SecondaryButton>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => void reload()} className="font-medium underline cursor-pointer">Try again</button>
        </div>
      )}
      {loading && !data && <div className="py-10 text-center text-sm text-[#6B7280]">Loading analytics...</div>}

      {/* Donation Analytics */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Donation Analytics</h3>
            <p className="text-xs text-[#6B7280]">Monthly donation trends and blood units generated · {DATE_RANGE_LABELS[dateRange]}</p>
          </div>
          {trendChangePercent !== null && (
            <div className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border ${trendChangePercent >= 0 ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
              {trendChangePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendChangePercent >= 0 ? "+" : ""}{trendChangePercent}% vs {data?.trend.comparedWith ?? "prior period"}
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filteredDonationTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C2D3E" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#7C2D3E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#166534" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#166534" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F0ED" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E5E2" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="donations" stroke="#7C2D3E" fill="url(#g1)" strokeWidth={2} name="Donations" />
            <Area type="monotone" dataKey="units" stroke="#166534" fill="url(#g2)" strokeWidth={2} name="Blood Units" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row: Inventory + Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Inventory by Blood Type</h3>
          <p className="text-xs text-[#6B7280] mb-4">Current usable units per blood type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={inventoryChartData} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F0ED" />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E5E2" }} formatter={(v) => [formatStock(Number(v)), "Usable Units"]} />
              <Bar dataKey="units" fill="#7C2D3E" radius={[4, 4, 0, 0]} name="Usable Units" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Testing Analytics</h3>
          <p className="text-xs text-[#6B7280] mb-4">Screening outcome distribution</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={testingOutcomeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {testingOutcomeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {testingOutcomeData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[#6B7280]">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-[#1C1C2E]">{d.value}</span>
                    <span className="text-[#9CA3AF] ml-1">({Math.round(d.value / Math.max(1, testingOutcomeData.reduce((s, x) => s + x.value, 0)) * 100)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Event Performance */}
      <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
        <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Event Analytics</h3>
        <p className="text-xs text-[#6B7280] mb-4">Participation and donation collection per event · {DATE_RANGE_LABELS[dateRange]}</p>
        {eventPerf.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-[#9CA3AF]">
            No events fall within this date range.
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={eventPerf} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F0ED" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E5E2" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="preRegistered" fill="#E8D0D4" radius={[4, 4, 0, 0]} name="Pre-Registered" />
            <Bar dataKey="donations" fill="#7C2D3E" radius={[4, 4, 0, 0]} name="Donations" />
            <Bar dataKey="units" fill="#C9363A" radius={[4, 4, 0, 0]} name="Blood Units" />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Usability Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h3 className="font-semibold text-[#1C1C2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Blood Unit Status</h3>
          <p className="text-xs text-[#6B7280] mb-4">Usability classification of all collected units</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={unitStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {unitStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {unitStatusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[#6B7280]">{d.name}</span>
                  </div>
                  <span className="font-semibold text-[#1C1C2E]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E5E2] shadow-sm p-5">
          <h3 className="font-semibold text-[#1C1C2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Usability Rates</h3>
          <div className="space-y-3">
            {usabilityData.map((d) => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#6B7280]">{d.name}</span>
                  <span className="font-semibold text-[#1C1C2E]">{d.value}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
