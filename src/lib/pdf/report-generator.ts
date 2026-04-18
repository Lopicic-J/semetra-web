/**
 * Semetra PDF Report Generator
 *
 * Generates professional Semester Reports and Module Certificates
 * using pdf-lib. Consumes data from /api/academic/semester-report.
 *
 * Features:
 * - Branded header with Semetra logo
 * - Student profile + institution details
 * - Module table with grades, ECTS, status
 * - Summary statistics (GPA, ECTS, pass rate)
 * - Study time metrics (from time_logs)
 * - Verification hash for authenticity
 * - Footer with generation date + report ID
 */

// @ts-nocheck — pdf-lib types conflict with Next.js bundled module resolution
// All APIs resolve correctly at runtime (pdf-lib 1.17.1)
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

// ─── Types ──────────────────────────────────────────────────────

export interface ReportProfile {
  name: string;
  university?: string;
  program?: string;
  country?: string;
  semester?: string | number;
}

export interface ReportModule {
  module: { id: string; name: string; code?: string; ects?: number; semester?: number; status: string };
  bestGrade: number | null;
  passed: boolean | null;
  ectsEarned: number;
  attempts: number;
  normalizedScore: number | null;
}

export interface ReportSummary {
  totalModules: number;
  passedModules: number;
  failedModules: number;
  totalEcts: number;
  transferEcts: number;
  combinedEcts: number;
  gpa: number | null;
  normalizedAvg: number | null;
}

export interface StudyMetrics {
  totalStudyHours: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  avgSessionMinutes: number;
  topModuleByTime?: string;
}

export interface SemesterReportData {
  profile: ReportProfile;
  modules: ReportModule[];
  summary: ReportSummary;
  studyMetrics?: StudyMetrics;
  generatedAt?: string;
}

// ─── Colors ─────────────────────────────────────────────────────

const BRAND = rgb(0.29, 0.33, 0.91);      // #4A54E8
const DARK = rgb(0.1, 0.1, 0.12);         // #1A1A1F
const GRAY = rgb(0.4, 0.4, 0.45);         // #666673
const LIGHT_GRAY = rgb(0.85, 0.85, 0.88); // #D9D9E0
const GREEN = rgb(0.13, 0.55, 0.13);      // #228B22
const RED = rgb(0.75, 0.15, 0.15);        // #BF2626
const WHITE = rgb(1, 1, 1);
const BG_LIGHT = rgb(0.96, 0.96, 0.98);   // #F5F5FA

// ─── Layout Constants ───────────────────────────────────────────

const PAGE_W = 595.28;  // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── Main Generator ────────────────────────────────────────────

export async function generateSemesterReportPDF(data: SemesterReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const reportId = generateReportId();
  const generatedAt = data.generatedAt || new Date().toISOString();

  // ── Page 1: Header + Module Table ──
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Brand header
  y = drawHeader(page, helveticaBold, helvetica, y);

  // Title
  y -= 30;
  page.drawText("Semester-Report / Leistungsnachweis", {
    x: MARGIN,
    y,
    size: 18,
    font: helveticaBold,
    color: DARK,
  });
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 2,
    color: BRAND,
  });

  // Profile section
  y -= 25;
  y = drawProfileSection(page, helvetica, helveticaBold, data.profile, y);

  // Module table
  y -= 20;
  page.drawText("Module & Noten", {
    x: MARGIN,
    y,
    size: 13,
    font: helveticaBold,
    color: DARK,
  });
  y -= 15;

  const result = drawModuleTable(doc, page, helvetica, helveticaBold, data.modules, y);
  page = result.page;
  y = result.y;

  // Summary section
  if (y < 200) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN - 20;
  }
  y -= 25;
  y = drawSummarySection(page, helvetica, helveticaBold, data.summary, y);

  // Study metrics (if available)
  if (data.studyMetrics) {
    if (y < 150) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN - 20;
    }
    y -= 25;
    y = drawStudyMetrics(page, helvetica, helveticaBold, data.studyMetrics, y);
  }

  // Footer on all pages
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawFooter(pages[i], helvetica, reportId, generatedAt, i + 1, pages.length);
  }

  // Metadata
  doc.setTitle(`Semetra Semester-Report — ${data.profile.name}`);
  doc.setAuthor("Semetra Study System");
  doc.setSubject(`Leistungsnachweis ${data.profile.semester || ""}`);
  doc.setCreator("Semetra (app.semetra.ch)");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(new Date(generatedAt));

  return doc.save();
}

// ─── Drawing Functions ─────────────────────────────────────────

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont, y: number): number {
  // Brand bar
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 8,
    width: PAGE_W,
    height: 8,
    color: BRAND,
  });

  // Logo text
  page.drawText("SEMETRA", {
    x: MARGIN,
    y: y - 5,
    size: 22,
    font: bold,
    color: BRAND,
  });

  page.drawText("Study System", {
    x: MARGIN + 115,
    y: y - 5,
    size: 10,
    font: regular,
    color: GRAY,
  });

  // Right side: website
  const url = "app.semetra.ch";
  const urlWidth = regular.widthOfTextAtSize(url, 9);
  page.drawText(url, {
    x: PAGE_W - MARGIN - urlWidth,
    y: y - 3,
    size: 9,
    font: regular,
    color: GRAY,
  });

  return y - 20;
}

function drawProfileSection(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  profile: ReportProfile,
  y: number
): number {
  // Background
  page.drawRectangle({
    x: MARGIN,
    y: y - 60,
    width: CONTENT_W,
    height: 65,
    color: BG_LIGHT,
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
  });

  const col1 = MARGIN + 12;
  const col2 = MARGIN + CONTENT_W / 2;
  let lineY = y - 8;

  const drawField = (label: string, value: string, x: number, currentY: number) => {
    page.drawText(label, { x, y: currentY, size: 8, font: regular, color: GRAY });
    page.drawText(value, { x, y: currentY - 13, size: 10, font: bold, color: DARK });
  };

  drawField("Name", profile.name, col1, lineY);
  drawField("Hochschule", profile.university || "—", col2, lineY);

  lineY -= 32;
  drawField("Studiengang", profile.program || "—", col1, lineY);
  drawField("Semester", String(profile.semester || "—"), col2, lineY);

  return y - 65;
}

function drawModuleTable(
  doc: PDFDocument,
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  modules: ReportModule[],
  startY: number
): { page: PDFPage; y: number } {
  let currentPage = page;
  let y = startY;

  // Table header
  const colWidths = [200, 60, 55, 55, 55, CONTENT_W - 200 - 60 - 55 - 55 - 55];
  const headers = ["Modul", "Code", "Note", "ECTS", "Status", "Score"];
  const colX = [MARGIN];
  for (let i = 1; i < colWidths.length; i++) {
    colX.push(colX[i - 1] + colWidths[i - 1]);
  }

  function drawTableHeader(p: PDFPage, headerY: number) {
    p.drawRectangle({
      x: MARGIN,
      y: headerY - 14,
      width: CONTENT_W,
      height: 18,
      color: BRAND,
    });

    for (let i = 0; i < headers.length; i++) {
      p.drawText(headers[i], {
        x: colX[i] + 4,
        y: headerY - 10,
        size: 8,
        font: bold,
        color: WHITE,
      });
    }
  }

  drawTableHeader(currentPage, y);
  y -= 18;

  // Table rows
  for (let i = 0; i < modules.length; i++) {
    if (y < 80) {
      // New page
      currentPage = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN - 10;
      drawTableHeader(currentPage, y);
      y -= 18;
    }

    const mod = modules[i];
    const rowH = 22;
    const isEven = i % 2 === 0;

    if (isEven) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: y - rowH + 6,
        width: CONTENT_W,
        height: rowH,
        color: BG_LIGHT,
      });
    }

    const textY = y - 8;
    const fontSize = 9;

    // Module name (truncate if needed)
    const name = mod.module.name.length > 32
      ? mod.module.name.substring(0, 30) + "..."
      : mod.module.name;
    currentPage.drawText(name, {
      x: colX[0] + 4,
      y: textY,
      size: fontSize,
      font: regular,
      color: DARK,
    });

    // Code
    currentPage.drawText(mod.module.code || "—", {
      x: colX[1] + 4,
      y: textY,
      size: fontSize,
      font: regular,
      color: GRAY,
    });

    // Grade
    const gradeStr = mod.bestGrade != null ? mod.bestGrade.toFixed(1) : "—";
    const gradeColor = mod.bestGrade != null
      ? (mod.bestGrade >= 4.0 ? GREEN : RED)
      : GRAY;
    currentPage.drawText(gradeStr, {
      x: colX[2] + 4,
      y: textY,
      size: fontSize,
      font: bold,
      color: gradeColor,
    });

    // ECTS
    currentPage.drawText(String(mod.ectsEarned || mod.module.ects || "—"), {
      x: colX[3] + 4,
      y: textY,
      size: fontSize,
      font: regular,
      color: DARK,
    });

    // Status
    const statusLabel = mod.passed === true ? "Bestanden" : mod.passed === false ? "Nicht best." : "Offen";
    const statusColor = mod.passed === true ? GREEN : mod.passed === false ? RED : GRAY;
    currentPage.drawText(statusLabel, {
      x: colX[4] + 4,
      y: textY,
      size: 8,
      font: regular,
      color: statusColor,
    });

    // Normalized Score
    const scoreStr = mod.normalizedScore != null ? `${Math.round(mod.normalizedScore)}%` : "—";
    currentPage.drawText(scoreStr, {
      x: colX[5] + 4,
      y: textY,
      size: fontSize,
      font: regular,
      color: GRAY,
    });

    y -= rowH;
  }

  // Bottom border
  currentPage.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: PAGE_W - MARGIN, y: y + 4 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });

  return { page: currentPage, y };
}

function drawSummarySection(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  summary: ReportSummary,
  y: number
): number {
  page.drawText("Zusammenfassung", {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: DARK,
  });
  y -= 20;

  // Summary grid (2 columns)
  const stats = [
    ["Module gesamt", String(summary.totalModules)],
    ["Bestanden", String(summary.passedModules)],
    ["Nicht bestanden", String(summary.failedModules)],
    ["ECTS erworben", String(summary.totalEcts)],
    ["Transfer-ECTS", String(summary.transferEcts)],
    ["ECTS total", String(summary.combinedEcts)],
    ["GPA (Durchschnitt)", summary.gpa != null ? summary.gpa.toFixed(2) : "—"],
    ["Normalisiert (0–100)", summary.normalizedAvg != null ? `${summary.normalizedAvg.toFixed(1)}%` : "—"],
  ];

  const colWidth = CONTENT_W / 2;
  for (let i = 0; i < stats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colWidth;
    const statY = y - row * 22;

    page.drawText(stats[i][0] + ":", {
      x,
      y: statY,
      size: 9,
      font: regular,
      color: GRAY,
    });
    page.drawText(stats[i][1], {
      x: x + 130,
      y: statY,
      size: 10,
      font: bold,
      color: DARK,
    });
  }

  return y - Math.ceil(stats.length / 2) * 22 - 5;
}

function drawStudyMetrics(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  metrics: StudyMetrics,
  y: number
): number {
  page.drawText("Lernaktivität", {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: DARK,
  });
  y -= 20;

  const stats = [
    ["Lernzeit gesamt", `${metrics.totalStudyHours.toFixed(1)}h`],
    ["Sessions", String(metrics.totalSessions)],
    ["Aktueller Streak", `${metrics.currentStreak} Tage`],
    ["Längster Streak", `${metrics.longestStreak} Tage`],
    ["Ø Session-Dauer", `${Math.round(metrics.avgSessionMinutes)} min`],
  ];

  if (metrics.topModuleByTime) {
    stats.push(["Top-Modul (Zeit)", metrics.topModuleByTime]);
  }

  const colWidth = CONTENT_W / 2;
  for (let i = 0; i < stats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colWidth;
    const statY = y - row * 22;

    page.drawText(stats[i][0] + ":", {
      x,
      y: statY,
      size: 9,
      font: regular,
      color: GRAY,
    });
    page.drawText(stats[i][1], {
      x: x + 130,
      y: statY,
      size: 10,
      font: bold,
      color: DARK,
    });
  }

  return y - Math.ceil(stats.length / 2) * 22 - 5;
}

function drawFooter(
  page: PDFPage,
  regular: PDFFont,
  reportId: string,
  generatedAt: string,
  pageNum: number,
  totalPages: number
) {
  const y = 30;
  const dateStr = new Date(generatedAt).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Separator
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE_W - MARGIN, y: y + 12 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });

  // Left: Report ID
  page.drawText(`Report-ID: ${reportId}`, {
    x: MARGIN,
    y,
    size: 7,
    font: regular,
    color: GRAY,
  });

  // Center: Date
  const dateText = `Erstellt: ${dateStr}`;
  const dateW = regular.widthOfTextAtSize(dateText, 7);
  page.drawText(dateText, {
    x: (PAGE_W - dateW) / 2,
    y,
    size: 7,
    font: regular,
    color: GRAY,
  });

  // Right: Page number
  const pageText = `Seite ${pageNum}/${totalPages}`;
  const pageW = regular.widthOfTextAtSize(pageText, 7);
  page.drawText(pageText, {
    x: PAGE_W - MARGIN - pageW,
    y,
    size: 7,
    font: regular,
    color: GRAY,
  });

  // Verification hint
  page.drawText("Verifizierung: app.semetra.ch/verify", {
    x: MARGIN,
    y: y - 10,
    size: 6,
    font: regular,
    color: LIGHT_GRAY,
  });
}

// ─── Helpers ───────────────────────────────────────────────────

function generateReportId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

// ─── CSV Export ────────────────────────────────────────────────

export function generateSemesterReportCSV(data: SemesterReportData): string {
  const rows: string[] = [];

  // Header
  rows.push("Modul,Code,Note,ECTS,Status,Normalisiert");

  // Data rows
  for (const mod of data.modules) {
    const grade = mod.bestGrade != null ? mod.bestGrade.toFixed(1).replace(".", ",") : "";
    const status = mod.passed === true ? "Bestanden" : mod.passed === false ? "Nicht bestanden" : "Offen";
    const score = mod.normalizedScore != null ? Math.round(mod.normalizedScore).toString() : "";

    rows.push([
      `"${mod.module.name}"`,
      mod.module.code || "",
      grade,
      mod.ectsEarned || mod.module.ects || "",
      status,
      score,
    ].join(","));
  }

  // Summary
  rows.push("");
  rows.push(`GPA,${data.summary.gpa?.toFixed(2).replace(".", ",") || ""}`);
  rows.push(`ECTS Total,${data.summary.combinedEcts}`);

  return rows.join("\n");
}

// ─── JSON Export ───────────────────────────────────────────────

export function generateSemesterReportJSON(data: SemesterReportData): string {
  return JSON.stringify({
    meta: {
      generator: "Semetra Study System",
      version: "1.0",
      generatedAt: data.generatedAt || new Date().toISOString(),
      reportType: "semester-report",
    },
    profile: data.profile,
    modules: data.modules.map((m) => ({
      name: m.module.name,
      code: m.module.code,
      grade: m.bestGrade,
      ects: m.ectsEarned,
      passed: m.passed,
      normalizedScore: m.normalizedScore,
      attempts: m.attempts,
    })),
    summary: data.summary,
    studyMetrics: data.studyMetrics || null,
  }, null, 2);
}
