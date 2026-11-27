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

const NO_BLOOD = "No Blood";
const stockText = (n: number) => (n === 0 ? NO_BLOOD : String(n));
const num = (n: number) => n.toLocaleString("en-US");

type Row = (string | number)[];
type AT = { lastAutoTable: { finalY: number } };
const finalY = (doc: jsPDF) => (doc as unknown as AT).lastAutoTable.finalY;
const MARGIN = 14;
const BRAND_RGB: [number, number, number] = [124, 45, 62];
const INK: [number, number, number] = [28, 28, 46];

function pdfBanner(doc: jsPDF, title: string, subtitle: string, tall: boolean) {
  const w = doc.internal.pageSize.getWidth();
  const h = tall ? 34 : 24;
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, w, h, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tall ? 20 : 15);
  doc.text("kaDUGO", MARGIN, tall ? 15 : 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(tall ? 11 : 10);
  doc.text(title, MARGIN, tall ? 22 : 17);
  doc.setFontSize(8.5);
  doc.text(subtitle, MARGIN, tall ? 29 : 21.5);
  return h + 10;
}

/** Draws a titled table; keeps title with its table; right-aligns numeric columns. */
function pdfSection(doc: jsPDF, y: number, title: string, head: string[], body: Row[], opts: { foot?: Row; stock?: number[] } = {}) {
  const pageH = doc.internal.pageSize.getHeight();
  const needed = 10 + 7 * (Math.min(body.length, 3) + 1);
  if (y + needed > pageH - 18) { doc.addPage(); y = 18; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, y);
  const rightCols: Record<number, { halign: "right" }> = {};
  head.slice(1).forEach((_, i) => { rightCols[i + 1] = { halign: "right" }; });
  autoTable(doc, {
    startY: y + 3,
    head: [head],
    body: body.length ? body.map((r) => r.map((c, i) => (opts.stock?.includes(i) && typeof c === "number" ? stockText(c) : typeof c === "number" ? num(c) : c))) : [[{ content: "No data for this period.", colSpan: head.length, styles: { halign: "center", textColor: [107, 114, 128] } }]],
    foot: opts.foot && body.length ? [opts.foot.map((c) => (typeof c === "number" ? num(c) : c))] : undefined,
    theme: "grid",
    headStyles: { fillColor: BRAND_RGB, textColor: 255, fontStyle: "bold", halign: "left" },
    footStyles: { fillColor: [253, 242, 244], textColor: BRAND_RGB, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 248, 247] },
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: [232, 229, 226], lineWidth: 0.2, textColor: INK, overflow: "linebreak" },
    columnStyles: rightCols,
    didParseCell: (d) => { if (d.section !== "body" && rightCols[d.column.index]) d.cell.styles.halign = "right"; },
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
  });
  return finalY(doc) + 10;
}

function pdfFooters(doc: jsPDF, label: string) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(232, 229, 226);
    doc.line(MARGIN, h - 13, w - MARGIN, h - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label, MARGIN, h - 8);
    doc.text(`Page ${i} of ${n}`, w - MARGIN, h - 8, { align: "right" });
  }
}

const sections = (d: AnalyticsReportData) => {
  const sum = (rows: { value: number }[]) => rows.reduce((s, r) => s + r.value, 0);
  return {
    trends: { head: ["Month", "Donations", "Blood Units"], body: d.donationTrends.map((r) => [r.month, r.donations, r.units] as Row), foot: ["Total", d.donationTrends.reduce((s, r) => s + r.donations, 0), d.donationTrends.reduce((s, r) => s + r.units, 0)] as Row },
    inventory: { head: ["Blood Type", "Usable Units"], body: d.inventoryByType.map((r) => [r.type, r.units] as Row) },
    testing: { head: ["Outcome", "Count"], body: d.testingOutcomes.map((r) => [r.name, r.value] as Row), foot: ["Total", sum(d.testingOutcomes)] as Row },
    events: { head: ["Event", "Pre-Registered", "Donations", "Blood Units"], body: d.eventPerformance.map((r) => [r.name, r.preRegistered, r.donations, r.units] as Row) },
    status: { head: ["Status", "Units"], body: d.unitStatus.map((r) => [r.name, r.value] as Row), foot: ["Total", sum(d.unitStatus)] as Row },
    usability: { head: ["Category", "Rate (%)"], body: d.usabilityRates.map((r) => [r.name, r.value] as Row) },
  };
};

/** "Generate Report" — narrative PDF: cover banner, highlights, then supporting tables. */
export function generateReportPDF(data: AnalyticsReportData) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = pdfBanner(doc, "Blood Donation & Inventory Analytics Report", `Cagayan Valley Regional Blood Center  •  ${data.dateRangeLabel}  •  Generated ${todayLabel()}`, true) + 4;

  const totalDonations = data.donationTrends.reduce((s, d) => s + d.donations, 0);
  const totalUnits = data.donationTrends.reduce((s, d) => s + d.units, 0);
  const totalPreReg = data.eventPerformance.reduce((s, e) => s + e.preRegistered, 0);
  const usableRate = data.usabilityRates.find((u) => u.name === "Usable")?.value ?? 0;
  const noStock = data.inventoryByType.filter((t) => t.units === 0).map((t) => t.type);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Summary Highlights", MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const highlights = [
    `${num(totalDonations)} donations were recorded over the reporting period, yielding ${num(totalUnits)} blood units.`,
    `${num(totalPreReg)} donors pre-registered across the events in this period.`,
    `${usableRate}% of collected units are currently classified as usable.`,
    noStock.length ? `No Blood (zero usable stock): ${noStock.join(", ")}.` : "All blood types currently have usable stock.",
  ];
  for (const line of highlights) {
    const wrapped = doc.splitTextToSize(line, w - MARGIN * 2 - 6);
    doc.setFillColor(...BRAND_RGB);
    doc.circle(MARGIN + 1.2, y - 1.2, 0.8, "F");
    doc.text(wrapped, MARGIN + 5, y);
    y += wrapped.length * 5 + 2;
  }
  y += 6;

  const s = sections(data);
  y = pdfSection(doc, y, "Donation Trends", s.trends.head, s.trends.body, { foot: s.trends.foot });
  y = pdfSection(doc, y, "Inventory by Blood Type", s.inventory.head, s.inventory.body, { stock: [1] });
  y = pdfSection(doc, y, "Testing Outcomes", s.testing.head, s.testing.body, { foot: s.testing.foot });
  y = pdfSection(doc, y, "Event Performance", s.events.head, s.events.body);
  y = pdfSection(doc, y, "Blood Unit Status", s.status.head, s.status.body, { foot: s.status.foot });
  pdfFooters(doc, "kaDUGO Analytics Report");
  doc.save(`kaDUGO-Analytics-Report-${fileDate()}.pdf`);
}

/** "Export PDF" — data tables only, compact, same look as the report. */
export function exportDataPDF(data: AnalyticsReportData) {
  const doc = new jsPDF();
  let y = pdfBanner(doc, "Analytics Data Export", `${data.dateRangeLabel}  •  Generated ${todayLabel()}`, false);
  const s = sections(data);
  y = pdfSection(doc, y, "Donation Trends", s.trends.head, s.trends.body, { foot: s.trends.foot });
  y = pdfSection(doc, y, "Inventory by Blood Type", s.inventory.head, s.inventory.body, { stock: [1] });
  y = pdfSection(doc, y, "Testing Outcomes", s.testing.head, s.testing.body, { foot: s.testing.foot });
  y = pdfSection(doc, y, "Event Performance", s.events.head, s.events.body);
  y = pdfSection(doc, y, "Blood Unit Status", s.status.head, s.status.body, { foot: s.status.foot });
  pdfSection(doc, y, "Usability Rates", s.usability.head, s.usability.body);
  pdfFooters(doc, "kaDUGO Analytics Data");
  doc.save(`kaDUGO-Analytics-Data-${fileDate()}.pdf`);
}

/**
 * "Export Excel" — ONE compact landscape sheet. Related tables sit side by side so the
 * report fits a single page width and stays short. Values stay numeric; zero stock is
 * shown as "No Blood" through a number format only.
 */
export async function exportDataExcel(data: AnalyticsReportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "kaDUGO";
  wb.created = new Date();
  const ws = wb.addWorksheet("Analytics Report", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, horizontalCentered: true },
    headerFooter: { oddFooter: "&LkaDUGO Analytics Report&RPage &P of &N" },
    views: [{ showGridLines: false }],
  });
  // A-D: wide table | E: gap | F-G | H: gap | I-J
  const widths = [30, 14, 14, 14, 3, 20, 16, 3, 22, 14];
  widths.forEach((wd, i) => { ws.getColumn(i + 1).width = wd; });

  const BR = "FF7C2D3E", BORDER = { style: "thin" as const, color: { argb: "FFE8E5E2" } };
  const box = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  const LAST = 10;

  // Title block
  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "kaDUGO — Blood Donation & Inventory Analytics";
  t.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;
  ws.mergeCells(2, 1, 2, LAST);
  const sub = ws.getCell(2, 1);
  sub.value = `Cagayan Valley Regional Blood Center  •  ${data.dateRangeLabel}  •  Generated ${todayLabel()}`;
  sub.font = { size: 10, color: { argb: "FFFFFFFF" } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= LAST; c++) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BR } };

  const totalDon = data.donationTrends.reduce((s, d) => s + d.donations, 0);
  const totalUnits = data.donationTrends.reduce((s, d) => s + d.units, 0);
  const usableRate = data.usabilityRates.find((u) => u.name === "Usable")?.value ?? 0;
  ws.mergeCells(3, 1, 3, LAST);
  const hl = ws.getCell(3, 1);
  hl.value = `Highlights:  ${num(totalDon)} donations  •  ${num(totalUnits)} blood units  •  ${usableRate}% usable`;
  hl.font = { bold: true, size: 10, color: { argb: BR } };
  hl.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(3).height = 22;

  /** Writes a titled table at (row, col); returns the next free row. */
  const table = (row: number, col: number, title: string, head: string[], body: Row[], opts: { foot?: Row; stockCol?: number; percent?: boolean } = {}) => {
    const span = head.length;
    ws.mergeCells(row, col, row, col + span - 1);
    const tc = ws.getCell(row, col);
    tc.value = title;
    tc.font = { bold: true, size: 11, color: { argb: "FF1C1C2E" } };
    tc.alignment = { vertical: "middle" };
    ws.getRow(row).height = 20;
    head.forEach((h, i) => {
      const c = ws.getCell(row + 1, col + i);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BR } };
      c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", wrapText: true };
      c.border = box;
    });
    ws.getRow(row + 1).height = 20;
    const rows = body.length ? body : [["No data for this period.", ...head.slice(1).map(() => "")] as Row];
    rows.forEach((r, ri) => {
      r.forEach((v, i) => {
        const c = ws.getCell(row + 2 + ri, col + i);
        c.value = v;
        c.border = box;
        c.font = { size: 10 };
        c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", wrapText: i === 0, indent: i === 0 ? 1 : 0 };
        if (typeof v === "number") c.numFmt = opts.stockCol === i ? '[=0]"No Blood";#,##0' : opts.percent ? '0"%"' : "#,##0";
        if (ri % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F8F7" } };
      });
      ws.getRow(row + 2 + ri).height = 18;
    });
    let end = row + 2 + rows.length;
    if (opts.foot && body.length) {
      opts.foot.forEach((v, i) => {
        const c = ws.getCell(end, col + i);
        c.value = v;
        c.font = { bold: true, size: 10, color: { argb: BR } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF2F4" } };
        c.border = box;
        c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", indent: i === 0 ? 1 : 0 };
        if (typeof v === "number") c.numFmt = "#,##0";
      });
      ws.getRow(end).height = 18;
      end++;
    }
    return end;
  };

  const s = sections(data);
  // Band 1: trends | inventory | unit status
  const b1 = 5;
  const e1 = Math.max(
    table(b1, 1, "Donation Trends", s.trends.head, s.trends.body, { foot: s.trends.foot }),
    table(b1, 6, "Inventory by Blood Type", s.inventory.head, s.inventory.body, { stockCol: 1 }),
    table(b1, 9, "Blood Unit Status", s.status.head, s.status.body, { foot: s.status.foot }),
  );
  // Band 2: events | testing + usability stacked
  const b2 = e1 + 1;
  const testEnd = table(b2, 6, "Testing Outcomes", s.testing.head, s.testing.body, { foot: s.testing.foot });
  const e2 = Math.max(
    table(b2, 1, "Event Performance", s.events.head, s.events.body),
    testEnd,
    table(b2, 9, "Usability Rates", s.usability.head, s.usability.body, { percent: true }),
  );
  ws.pageSetup.printArea = `A1:J${e2}`;
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 3 }];

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `kaDUGO-Analytics-Data-${fileDate()}.xlsx`
  );
}
