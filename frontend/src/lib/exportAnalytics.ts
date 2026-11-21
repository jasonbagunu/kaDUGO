import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import ExcelJS from "exceljs";

export interface AnalyticsReportData {
  dateRangeLabel: string;
  donationTrends: { month: string; donations: number; units: number }[];
  inventoryByType: { type: string; units: number }[];
  testingOutcomes: { name: string; value: number }[];
  eventPerformance: { name: string; preRegistered: number; donations: number; units: number }[];
  unitStatus: { name: string; value: number }[];
  usabilityRates: { name: string; value: number }[];
}

const BRAND = "#7C2D3E";
const todayLabel = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const fileDate = () => new Date().toISOString().slice(0, 10);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Generate Report" — a formatted narrative PDF report with a cover section
 * and summary highlights, followed by the supporting data tables.
 */
export function generateReportPDF(data: AnalyticsReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cover section
  doc.setFillColor(124, 45, 62); // BRAND
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("kaDUGO", 14, 22);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Blood Donation & Inventory Analytics Report", 14, 31);
  doc.setFontSize(9);
  doc.text(`Cagayan Valley Regional Blood Center  \u2022  Generated ${todayLabel()}  \u2022  ${data.dateRangeLabel}`, 14, 38);

  doc.setTextColor(28, 28, 46);
  let y = 58;

  const totalDonations = data.donationTrends.reduce((s, d) => s + d.donations, 0);
  const totalUnits = data.donationTrends.reduce((s, d) => s + d.units, 0);
  const totalPreReg = data.eventPerformance.reduce((s, e) => s + e.preRegistered, 0);
  const usableRate = data.usabilityRates.find((u) => u.name === "Usable")?.value ?? 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Summary Highlights", 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const highlights = [
    `A total of ${totalDonations.toLocaleString()} donations were recorded over the reporting period, yielding ${totalUnits.toLocaleString()} blood units.`,
    `${totalPreReg.toLocaleString()} donors pre-registered across tracked donation events.`,
    `${usableRate}% of collected units are currently classified as usable inventory.`,
  ];
  for (const line of highlights) {
    const wrapped = doc.splitTextToSize(`\u2022  ${line}`, pageWidth - 28);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5.5 + 2;
  }
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Month", "Donations", "Blood Units"]],
    body: data.donationTrends.map((d) => [d.month, String(d.donations), String(d.units)]),
    headStyles: { fillColor: [124, 45, 62] },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(28, 28, 46);
    },
  });
  doc.text("Donation Trends", 14, y - 4);

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  const addTableSection = (title: string, head: string[][], body: string[][]) => {
    if (cursorY > 250) { doc.addPage(); cursorY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 28, 46);
    doc.text(title, 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 4,
      head,
      body,
      headStyles: { fillColor: [124, 45, 62] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  addTableSection(
    "Inventory by Blood Type",
    [["Blood Type", "Usable Units"]],
    data.inventoryByType.map((d) => [d.type, String(d.units)])
  );

  addTableSection(
    "Testing Outcomes",
    [["Outcome", "Count"]],
    data.testingOutcomes.map((d) => [d.name, String(d.value)])
  );

  addTableSection(
    "Event Performance",
    [["Event", "Pre-Registered", "Donations", "Blood Units"]],
    data.eventPerformance.map((d) => [d.name, String(d.preRegistered), String(d.donations), String(d.units)])
  );

  addTableSection(
    "Blood Unit Status",
    [["Status", "Units"]],
    data.unitStatus.map((d) => [d.name, String(d.value)])
  );

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`kaDUGO Analytics Report \u2014 Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`kaDUGO-Analytics-Report-${fileDate()}.pdf`);
}

/**
 * "Export PDF" — the raw data tables only, no narrative, for quick reference.
 */
export function exportDataPDF(data: AnalyticsReportData) {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(28, 28, 46);
  doc.text("kaDUGO Analytics \u2014 Data Export", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`${data.dateRangeLabel}  \u2022  Generated ${todayLabel()}`, 14, 22);

  let cursorY = 30;
  const section = (title: string, head: string[][], body: string[][]) => {
    if (cursorY > 255) { doc.addPage(); cursorY = 16; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(28, 28, 46);
    doc.text(title, 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head,
      body,
      headStyles: { fillColor: [124, 45, 62] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  };

  section("Donation Trends", [["Month", "Donations", "Blood Units"]], data.donationTrends.map((d) => [d.month, String(d.donations), String(d.units)]));
  section("Inventory by Blood Type", [["Blood Type", "Usable Units"]], data.inventoryByType.map((d) => [d.type, String(d.units)]));
  section("Testing Outcomes", [["Outcome", "Count"]], data.testingOutcomes.map((d) => [d.name, String(d.value)]));
  section("Event Performance", [["Event", "Pre-Registered", "Donations", "Blood Units"]], data.eventPerformance.map((d) => [d.name, String(d.preRegistered), String(d.donations), String(d.units)]));
  section("Blood Unit Status", [["Status", "Units"]], data.unitStatus.map((d) => [d.name, String(d.value)]));
  section("Usability Rates", [["Category", "Rate (%)"]], data.usabilityRates.map((d) => [d.name, String(d.value)]));

  doc.save(`kaDUGO-Analytics-Data-${fileDate()}.pdf`);
}

/**
 * "Export Excel" — a multi-sheet workbook, one sheet per dataset.
 */
export async function exportDataExcel(data: AnalyticsReportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "kaDUGO";
  wb.created = new Date();

  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C2D3E" } };
  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = headerFill;
    ws.columns.forEach((c) => { c.width = Math.max((c.header?.length ?? 10) + 4, 14); });
  };

  const trendsSheet = wb.addWorksheet("Donation Trends");
  trendsSheet.columns = [
    { header: "Month", key: "month" },
    { header: "Donations", key: "donations" },
    { header: "Blood Units", key: "units" },
  ];
  trendsSheet.addRows(data.donationTrends);
  styleHeader(trendsSheet);

  const inventorySheet = wb.addWorksheet("Inventory by Type");
  inventorySheet.columns = [
    { header: "Blood Type", key: "type" },
    { header: "Usable Units", key: "units" },
  ];
  inventorySheet.addRows(data.inventoryByType);
  styleHeader(inventorySheet);

  const testingSheet = wb.addWorksheet("Testing Outcomes");
  testingSheet.columns = [
    { header: "Outcome", key: "name" },
    { header: "Count", key: "value" },
  ];
  testingSheet.addRows(data.testingOutcomes);
  styleHeader(testingSheet);

  const eventsSheet = wb.addWorksheet("Event Performance");
  eventsSheet.columns = [
    { header: "Event", key: "name" },
    { header: "Pre-Registered", key: "preRegistered" },
    { header: "Donations", key: "donations" },
    { header: "Blood Units", key: "units" },
  ];
  eventsSheet.addRows(data.eventPerformance);
  styleHeader(eventsSheet);

  const statusSheet = wb.addWorksheet("Unit Status");
  statusSheet.columns = [
    { header: "Status", key: "name" },
    { header: "Units", key: "value" },
  ];
  statusSheet.addRows(data.unitStatus);
  styleHeader(statusSheet);

  const usabilitySheet = wb.addWorksheet("Usability Rates");
  usabilitySheet.columns = [
    { header: "Category", key: "name" },
    { header: "Rate (%)", key: "value" },
  ];
  usabilitySheet.addRows(data.usabilityRates);
  styleHeader(usabilitySheet);

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `kaDUGO-Analytics-Data-${fileDate()}.xlsx`
  );
}
