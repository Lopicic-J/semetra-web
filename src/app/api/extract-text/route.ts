import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * POST /api/extract-text
 *
 * Extracts text from PDF, DOCX, and PPTX files.
 * Requires authentication via Supabase auth token.
 *
 * Body: FormData with 'file' field
 * Returns: { text: string }
 */
export async function POST(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  try {
    let text = "";

    if (fileName.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else if (fileName.endsWith(".docx")) {
      text = await extractDocxText(buffer);
    } else if (fileName.endsWith(".pptx")) {
      text = await extractPptxText(buffer);
    } else if (fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv")) {
      text = new TextDecoder().decode(buffer);
    } else {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
    }

    return NextResponse.json({ text: text.slice(0, 12000) });
  } catch (err) {
    console.error("Text extraction error:", err);
    return NextResponse.json({ error: "Failed to extract text from file" }, { status: 400 });
  }
}

/**
 * Extract text from PDF — fallback-only approach using raw bytes
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdf = await pdfParse(Buffer.from(buffer));
    return (pdf.text as string) || "";
  } catch {
    // Fallback: simple text extraction from PDF stream
    return extractPdfTextFallback(buffer);
  }
}

/**
 * Fallback PDF text extraction using regex on raw bytes
 */
function extractPdfTextFallback(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(uint8Array);

  // Simple regex to extract text between BT...ET operators
  const btEtRegex = /BT([\s\S]+?)ET/g;
  const lines: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const textRegex = /\(([^)]+)\)/g;
    let tm: RegExpExecArray | null;
    while ((tm = textRegex.exec(block)) !== null) {
      if (tm[1]) lines.push(tm[1]);
    }
  }

  return lines.join(" ");
}

/**
 * Extract text from DOCX using mammoth or fallback XML parsing
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return (result.value as string) || "";
  } catch {
    return extractDocxTextFallback(buffer);
  }
}

/**
 * Fallback DOCX text extraction from XML inside zip
 */
async function extractDocxTextFallback(buffer: ArrayBuffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require("jszip");
    const zip = new JSZip();
    await zip.loadAsync(buffer);

    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return "";

    const xmlContent: string = await xmlFile.async("text");
    const matches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    return matches.map((m: string) => m.replace(/<w:t[^>]*>|<\/w:t>/g, "")).join(" ");
  } catch {
    return "";
  }
}

/**
 * Extract text from PPTX slides
 */
async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require("jszip");
    const zip = new JSZip();
    await zip.loadAsync(buffer);

    const texts: string[] = [];

    const slideFiles = Object.keys(zip.files).filter(
      (name: string) => /^ppt\/slides\/slide\d+\.xml$/.test(name)
    );

    for (const slideFile of slideFiles) {
      const file = zip.file(slideFile);
      if (!file) continue;

      const xmlContent: string = await file.async("text");
      const matches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const slideText = matches
        .map((m: string) => m.replace(/<a:t>|<\/a:t>/g, ""))
        .filter((t: string) => t.trim());
      texts.push(...slideText);
    }

    return texts.join(" ");
  } catch {
    return "";
  }
}
