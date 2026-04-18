/**
 * Semetra Module Certificate Generator
 *
 * Generates professional PDF certificates for completed modules.
 * Each certificate includes a QR-code-compatible verification URL.
 */

// @ts-nocheck — pdf-lib types conflict with Next.js bundled module resolution
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { generateReportId } from "@/lib/verification/hash";

// ── Types ──────────────────────────────────────────────────────────

export interface CertificateData {
  studentName: string;
  university?: string;
  program?: string;
  moduleName: string;
  moduleCode?: string;
  ects: number;
  grade?: number | null;
  passed: boolean;
  completedAt: string;
  semester?: string | number;
  reportId?: string;
}

// ── Colors ─────────────────────────────────────────────────────────

const BRAND = rgb(0.29, 0.33, 0.91);       // #4A54E8
const BRAND_LIGHT = rgb(0.91, 0.92, 0.98); // #E8EBFA
const GOLD = rgb(0.78, 0.63, 0.13);        // #C7A121
const DARK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.4, 0.4, 0.45);
const LIGHT_GRAY = rgb(0.75, 0.75, 0.78);
const WHITE = rgb(1, 1, 1);

// ── Layout ─────────────────────────────────────────────────────────

const PAGE_W = 841.89; // A4 Landscape
const PAGE_H = 595.28;
const MARGIN = 60;

// ── Main Generator ─────────────────────────────────────────────────

export async function generateModuleCertificatePDF(
  data: CertificateData
): Promise<{ bytes: Uint8Array; reportId: string }> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const reportId = data.reportId || generateReportId();
  const page = doc.addPage([PAGE_W, PAGE_H]);

  // ── Decorative border ──
  drawBorder(page);

  // ── Brand header ──
  let y = PAGE_H - MARGIN - 30;
  const titleText = "SEMETRA";
  const titleW = helveticaBold.widthOfTextAtSize(titleText, 14);
  page.drawText(titleText, {
    x: (PAGE_W - titleW) / 2,
    y: y + 10,
    size: 14,
    font: helveticaBold,
    color: BRAND,
  });

  y -= 20;
  const subtitle = "Modul-Zertifikat";
  const subtitleW = helveticaBold.widthOfTextAtSize(subtitle, 28);
  page.drawText(subtitle, {
    x: (PAGE_W - subtitleW) / 2,
    y,
    size: 28,
    font: helveticaBold,
    color: DARK,
  });

  // ── Decorative line ──
  y -= 15;
  const lineW = 200;
  page.drawLine({
    start: { x: (PAGE_W - lineW) / 2, y },
    end: { x: (PAGE_W + lineW) / 2, y },
    thickness: 2,
    color: GOLD,
  });

  // ── "Hiermit wird bestätigt, dass" ──
  y -= 40;
  const preamble = "Hiermit wird bestätigt, dass";
  const preambleW = timesItalic.widthOfTextAtSize(preamble, 13);
  page.drawText(preamble, {
    x: (PAGE_W - preambleW) / 2,
    y,
    size: 13,
    font: timesItalic,
    color: GRAY,
  });

  // ── Student name ──
  y -= 40;
  const nameW = helveticaBold.widthOfTextAtSize(data.studentName, 26);
  page.drawText(data.studentName, {
    x: (PAGE_W - nameW) / 2,
    y,
    size: 26,
    font: helveticaBold,
    color: DARK,
  });

  // Underline
  y -= 5;
  const underlineW = Math.max(nameW + 40, 300);
  page.drawLine({
    start: { x: (PAGE_W - underlineW) / 2, y },
    end: { x: (PAGE_W + underlineW) / 2, y },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });

  // ── University + Program ──
  if (data.university || data.program) {
    y -= 22;
    const uniText = [data.university, data.program].filter(Boolean).join(" — ");
    const uniW = helvetica.widthOfTextAtSize(uniText, 11);
    page.drawText(uniText, {
      x: (PAGE_W - uniW) / 2,
      y,
      size: 11,
      font: helvetica,
      color: GRAY,
    });
  }

  // ── "das Modul erfolgreich abgeschlossen hat:" ──
  y -= 30;
  const completionText = "das folgende Modul erfolgreich abgeschlossen hat:";
  const completionW = timesItalic.widthOfTextAtSize(completionText, 13);
  page.drawText(completionText, {
    x: (PAGE_W - completionW) / 2,
    y,
    size: 13,
    font: timesItalic,
    color: GRAY,
  });

  // ── Module name ──
  y -= 38;
  const moduleText = data.moduleName;
  const moduleSize = moduleText.length > 40 ? 20 : 24;
  const moduleW = helveticaBold.widthOfTextAtSize(moduleText, moduleSize);
  page.drawText(moduleText, {
    x: (PAGE_W - moduleW) / 2,
    y,
    size: moduleSize,
    font: helveticaBold,
    color: BRAND,
  });

  // ── Module code ──
  if (data.moduleCode) {
    y -= 20;
    const codeText = `(${data.moduleCode})`;
    const codeW = helvetica.widthOfTextAtSize(codeText, 10);
    page.drawText(codeText, {
      x: (PAGE_W - codeW) / 2,
      y,
      size: 10,
      font: helvetica,
      color: GRAY,
    });
  }

  // ── Details row: ECTS | Note | Semester ──
  y -= 35;
  const details: string[] = [];
  details.push(`${data.ects} ECTS`);
  if (data.grade != null) details.push(`Note: ${data.grade.toFixed(1)}`);
  if (data.semester) details.push(`Semester ${data.semester}`);
  const detailText = details.join("   ·   ");
  const detailW = helveticaBold.widthOfTextAtSize(detailText, 12);
  page.drawText(detailText, {
    x: (PAGE_W - detailW) / 2,
    y,
    size: 12,
    font: helveticaBold,
    color: DARK,
  });

  // ── Completion date ──
  y -= 25;
  const dateStr = new Date(data.completedAt).toLocaleDateString("de-CH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateText = `Abgeschlossen am ${dateStr}`;
  const dateW = helvetica.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, {
    x: (PAGE_W - dateW) / 2,
    y,
    size: 10,
    font: helvetica,
    color: GRAY,
  });

  // ── Footer: Verification ──
  const footerY = MARGIN + 25;

  // Report ID
  const idText = `Report-ID: ${reportId}`;
  const idW = helvetica.widthOfTextAtSize(idText, 8);
  page.drawText(idText, {
    x: MARGIN,
    y: footerY,
    size: 8,
    font: helvetica,
    color: GRAY,
  });

  // Verify URL
  const verifyText = `Verifizierung: app.semetra.ch/verify/${reportId}`;
  const verifyW = helvetica.widthOfTextAtSize(verifyText, 8);
  page.drawText(verifyText, {
    x: PAGE_W - MARGIN - verifyW,
    y: footerY,
    size: 8,
    font: helvetica,
    color: GRAY,
  });

  // Semetra brand
  const brandFooter = "Generiert von Semetra Study System";
  const brandW = helvetica.widthOfTextAtSize(brandFooter, 7);
  page.drawText(brandFooter, {
    x: (PAGE_W - brandW) / 2,
    y: footerY - 12,
    size: 7,
    font: helvetica,
    color: LIGHT_GRAY,
  });

  // ── Metadata ──
  doc.setTitle(`Semetra Zertifikat — ${data.moduleName}`);
  doc.setAuthor("Semetra Study System");
  doc.setSubject(`Modul-Zertifikat: ${data.moduleName}`);
  doc.setCreator("Semetra (app.semetra.ch)");

  const bytes = await doc.save();
  return { bytes: new Uint8Array(bytes), reportId };
}

// ── Decorative Border ──────────────────────────────────────────────

function drawBorder(page: PDFPage) {
  const inset = 30;

  // Outer border
  page.drawRectangle({
    x: inset,
    y: inset,
    width: PAGE_W - 2 * inset,
    height: PAGE_H - 2 * inset,
    borderColor: BRAND,
    borderWidth: 2,
    color: WHITE,
  });

  // Inner border
  const inset2 = inset + 8;
  page.drawRectangle({
    x: inset2,
    y: inset2,
    width: PAGE_W - 2 * inset2,
    height: PAGE_H - 2 * inset2,
    borderColor: BRAND_LIGHT,
    borderWidth: 1,
    opacity: 0,
  });

  // Corner decorations (small squares)
  const cornerSize = 12;
  const corners = [
    { x: inset - 2, y: inset - 2 },
    { x: PAGE_W - inset - cornerSize + 2, y: inset - 2 },
    { x: inset - 2, y: PAGE_H - inset - cornerSize + 2 },
    { x: PAGE_W - inset - cornerSize + 2, y: PAGE_H - inset - cornerSize + 2 },
  ];
  for (const c of corners) {
    page.drawRectangle({
      x: c.x,
      y: c.y,
      width: cornerSize,
      height: cornerSize,
      color: BRAND,
    });
  }
}
