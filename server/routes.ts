import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";

function routeError(res: Response, e: any, operation = "memproses data") {
  console.error("[route error]", e);
  return res.status(500).json({ error: `Gagal ${operation}. Silakan coba lagi.` });
}
import multer from "multer";
import path from "path";
import fs from "fs";
// import { createRequire } from "module";
// const require = createRequire(import.meta.url);
import { storage as db } from "./storage";
import { authMiddleware, requireRole, hashPassword, verifyPassword, signToken, generateRefreshToken } from "./auth";
import { randomUUID } from "crypto";
import {
  sendPermitSubmittedEmail,
  sendPermitStatusEmail,
  sendPermitLetterEmail,
  sendPermitPickupEmail,
  sendPermitCheckStatusEmail,
  sendPpidInfoRequestConfirmation,
  sendPpidInfoRequestReply,
} from "./email";
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table as DocxTable, TableRow as DocxTableRow,
  TableCell as DocxTableCell, WidthType, ImageRun, UnderlineType,
} from "docx";
import { promisify } from 'util';
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import * as xmlDom from "@xmldom/xmldom";

// ─── File Upload Setup ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function getMulter(subdir: string, maxSizeMB: number = 5) {
  const dir = path.join(uploadDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, dir),
      filename: (_, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });
}

function getMulterDocx(subdir: string, maxSizeMB?: number) {
  const dir = path.join(uploadDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, dir),
      filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    // "tanpa batas" di multer = jangan set limits.fileSize
    ...(maxSizeMB ? { limits: { fileSize: maxSizeMB * 1024 * 1024 } } : {}),
    fileFilter: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, ext === ".docx");
    },
  });
}

/** Multer tanpa batas ukuran dan tanpa filter tipe file — untuk dokumen PPID */
function getMulterUnlimited(subdir: string) {
  const dir = path.join(uploadDir, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, dir),
      filename: (_, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    // Tidak ada limits.fileSize = unlimited
  });
}

function fileUrl(subdir: string, filename: string) {
  return `/uploads/${subdir}/${filename}`;
}

function normalizeDate(v: any) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null; 
  if (v instanceof Date) return v;
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) throw new Error("publishedAt invalid");
  return dt;
}

/**
 * Escape string untuk aman dimasukkan ke XML
 */
function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escape string untuk XML sekaligus mengubah newline (\n) menjadi
 * line-break DOCX yang valid: </w:t><w:br/><w:t xml:space="preserve">
 * sehingga Enter pada nilai variabel menghasilkan baris baru di Word.
 */
function escapeXmlWithBreaks(str: string): string {
  if (!str) return "";
  const lines = str.split("\n");
  return lines
    .map(line => escapeXml(line))
    .join('</w:t></w:r><w:r><w:br/></w:r><w:r><w:t xml:space="preserve">');
}

/**
 * Generate DOCX dari template dengan raw XML replacement.
 * Mendukung format <<PLACEHOLDER>> yang disimpan sebagai &lt;&lt;PLACEHOLDER&gt;&gt; di XML.
 * 
 * @param templateBuffer  Buffer file .docx template (bisa dari disk atau upload langsung)
 * @param replacements    Map dari nama placeholder ke nilai penggantinya
 */
function generateDocxFromBuffer(
  templateBuffer: Buffer,
  replacements: Record<string, string>
): Buffer {
  const zip = new PizZip(templateBuffer);

  // File XML utama konten dokumen
  const xmlTargets = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footer2.xml",
  ];

  for (const target of xmlTargets) {
    if (!zip.files[target]) continue;

    let xml = zip.files[target].asText();

    for (const [placeholder, value] of Object.entries(replacements)) {
      // Gunakan escapeXmlWithBreaks agar \n dalam nilai diubah menjadi line-break Word
      const safeValue = escapeXmlWithBreaks(value);
      // Format XML-escaped: &lt;&lt;PLACEHOLDER&gt;&gt;
      const xmlEscaped = `&lt;&lt;${placeholder}&gt;&gt;`;
      xml = xml.split(xmlEscaped).join(safeValue);
      
      // Juga coba format tanpa XML escape (untuk kompatibilitas)
      const plainEscaped = `<<${placeholder}>>`;
      if (xml.includes(plainEscaped)) {
        xml = xml.split(plainEscaped).join(safeValue);
      }
    }

    zip.file(target, xml);
  }

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

/**
 * Buat mapping data dari permit ke placeholder template
 */
function buildLetterReplacements(permit: any, template?: any): Record<string, string> {
  const formatDate = (d: any): string => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).toUpperCase();
  };

  const formatDateForSurat = (d: any): string => {
    if (!d) return "-";
    const date = new Date(d);
    const day = date.getDate();
    const month = date.toLocaleDateString("id-ID", { month: "long" }).toUpperCase();
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const today = new Date();
  const city = template?.city || "Palangka Raya";

  // Format tembusan as numbered list for DOCX
  const tembusanRaw: string = template?.tembusan || "";
  const tembusanLines = tembusanRaw
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const tembusanFormatted = tembusanLines.length > 0
    ? tembusanLines.map((line: string, i: number) => `${i + 1}. ${line}`).join("\n")
    : "-";

  // Get the letter number (full or partial)
  // const letterNumber = permit.issuedLetterNumber || "";
  
  // // Extract just the number part for some templates
  // const letterNumberOnly = letterNumber.replace(/[^0-9]/g, "");

  return {
    // Basic data
    "NAMA": permit.fullName ?? "-",
    "NIM": permit.nimNik ?? "-",
    "NIM/NIK": permit.nimNik ?? "-",
    "NIK": permit.nimNik ?? "-",
    
    // Surat Rekomendasi specific
    "NOMOR SURAT IZIN": permit.issuedLetterNumber,
    "NOMOR SURAT PENGANTAR": permit.introLetterNumber,
    // "NOMOR": letterNumberOnly,
    
    // Pejabat & Institution
    "PEJABAT SURAT PENGANTAR": permit.signerPosition || "-",
    "TIM SURVEY/PENELITI": permit.institution ?? "-",
    "INSTANSI": permit.institution ?? "-",
    "NAMA INSTANSI": permit.institution ?? "-",
    "BAPPEDA KABUPATEN": permit.recipientCity ?? "-",
    
    // Research
    "JUDUL PENELITIAN": permit.researchTitle ?? "-",
    "LOKASI PENELITIAN": permit.researchLocation ?? "-",
    "DURASI PENELITIAN": permit.researchDuration ?? "-",
    
    // Dates
    "TANGGAL SURAT PENGANTAR": formatDate(permit.introLetterDate),
    "TANGGAL SURAT": formatDate(permit.issuedLetterDate),
    "TANGGAL SURAT IZIN": formatDate(permit.issuedLetterDate),
    "TGL SRT DITETAPKAN": formatDateForSurat(permit.issuedLetterDate),
    "TGL MULAI": formatDate(permit.researchStartDate),
    "TGL SELESAI": formatDate(permit.researchEndDate),
    "TANGGAL MULAI PENELITIAN": formatDate(permit.researchStartDate),
    "TANGGAL SELESAI PENELITIAN": formatDate(permit.researchEndDate),
    
    // Contact
    "TELEPON": permit.phoneWa ?? "-",
    "EMAIL": permit.email ?? "-",
    "ALAMAT": permit.address ?? "-",
    
    // Template config
    "NAMA PEJABAT": template?.officialName ?? "Endy, ST, MT",
    "JABATAN": template?.officialPosition ?? "Kepala Bidang Riset dan Inovasi Daerah",
    "JABATAN PEJABAT": template?.officialPosition ?? "Kepala Bidang Riset dan Inovasi Daerah",
    "NIP": template?.officialNip ?? "197412232000031002",
    "NIP PEJABAT": template?.officialNip ?? "197412232000031002",
    "KOTA": city,
    "KOTA PENELITIAN": permit.recipientCity ?? city,
    "KEPADA": permit.recipientName ?? "Walikota Palangka Raya",
    "TUJUAN KEPADA": permit.recipientName ?? "Walikota Palangka Raya",
    "TEMBUSAN": tembusanFormatted,
    
    // Current date
    "TANGGAL HARI INI": formatDate(today),
    "TANGGAL": formatDate(today),
    "TAHUN": String(today.getFullYear()),
    "BULAN": today.toLocaleDateString("id-ID", { month: "long" }).toUpperCase(),
  };
}


// ─── DOCX → PDF: LibreOffice (primary) + mammoth/puppeteer (fallback) ────────

/** Cek apakah LibreOffice tersedia di sistem */
function findLibreOfficePath(): string | undefined {
  const candidates = [
    "libreoffice",
    "soffice",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/opt/libreoffice/program/soffice",
  ];
  for (const p of candidates) {
    try {
      const result = require("child_process").execFileSync(p, ["--version"], {
        stdio: "pipe", timeout: 5000,
      });
      if (result) return p;
    } catch {}
  }
  return undefined;
}

/**
 * Konversi DOCX → PDF menggunakan LibreOffice headless.
 * Lebih akurat dari mammoth+puppeteer karena menggunakan renderer yang sama dengan LibreOffice Writer.
 * Returns null jika LibreOffice tidak tersedia.
 */
async function convertWithLibreOffice(docxBuffer: Buffer): Promise<Buffer | null> {
  const loPath = findLibreOfficePath();
  if (!loPath) return null;

  const os = require("os");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lo-conv-"));
  const inputPath = path.join(tmpDir, "input.docx");
  const outputPath = path.join(tmpDir, "input.pdf");

  try {
    fs.writeFileSync(inputPath, docxBuffer);
    await execFileAsync(loPath, [
      "--headless",
      "--norestore",
      "--nologo",
      "--nolockcheck",
      "--convert-to", "pdf",
      "--outdir", tmpDir,
      inputPath,
    ], { timeout: 60000 });

    if (!fs.existsSync(outputPath)) {
      console.warn("[LibreOffice] Konversi selesai tapi output PDF tidak ditemukan");
      return null;
    }
    const pdfBuffer = fs.readFileSync(outputPath);
    return pdfBuffer;
  } catch (err: any) {
    console.warn("[LibreOffice] Konversi gagal:", err.message);
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/** Cari path executable Chrome/Chromium yang terinstal */
function findChromePath(): string | undefined {
  // 1. Scan puppeteer cache (semua versi yang terinstall)
  const home = process.env.HOME || "/home/runner";
  for (const cacheRoot of [
    path.join(home, ".cache", "puppeteer", "chrome"),
    path.join("/root", ".cache", "puppeteer", "chrome"),
  ]) {
    try {
      const versions = fs.readdirSync(cacheRoot);
      for (const ver of versions.sort().reverse()) {
        for (const subDir of ["chrome-linux64", "chrome-linux"]) {
          const candidate = path.join(cacheRoot, ver, subDir, "chrome");
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch {}
  }
  // 2. Coba pakai path yang diketahui puppeteer
  try {
    const puppeteer = require("puppeteer");
    const ep = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
    if (ep && fs.existsSync(ep)) return ep;
  } catch {}
  // 3. System chromium / chrome
  const systemPaths = [
    "/usr/bin/google-chrome-stable", "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/usr/local/bin/chromium", "/snap/bin/chromium",
  ];
  for (const p of systemPaths) { if (fs.existsSync(p)) return p; }
  return undefined;
}

function buildLetterHtml(rawHtml: string): string {
  return `<!DOCTYPE html><html lang="id"><head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    background: white;
    padding: 2.54cm 2.54cm 2.54cm 3cm;
    max-width: 21cm;
    margin: 0 auto;
  }
  p { margin-bottom: 6pt; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0; }
  td, th { padding: 4pt 6pt; vertical-align: top; }
  img { max-width: 100%; height: auto; display: block; }
  strong, b { font-weight: bold; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  ul, ol { margin: 4pt 0 4pt 2em; }
  li { margin: 2pt 0; }
  h1,h2,h3,h4 { margin: 8px 0 4px; font-family: 'Times New Roman', Times, serif; }
</style></head><body>${rawHtml}</body></html>`;
}

// async function convertDocxToPdf(docxBuffer: Buffer, title = "Surat"): Promise<Buffer> {
//   const mammoth = require("mammoth");
//   const { value: rawHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });
//   const html = buildLetterHtml(rawHtml);

//   const executablePath = findChromePath();
//   if (!executablePath) {
//     throw new Error("Chrome tidak ditemukan di server. Pastikan Puppeteer sudah terinstall (jalankan: npx puppeteer browsers install chrome).");
//   }
//   const puppeteer = require("puppeteer");
//   const browser = await puppeteer.launch({
//     executablePath,
//     args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
//     headless: true,
//   });
//   const page = await browser.newPage();
//   await page.setContent(html, { waitUntil: "networkidle0" });
//   const pdfUint8 = await page.pdf({ format: "A4", printBackground: true });
//   await browser.close();
//   return Buffer.from(pdfUint8);
// }
// async function convertDocxToPdf(docxBuffer: Buffer, title = "Surat"): Promise<Buffer> {
//   const mammoth = require("mammoth");
//   const { value: rawHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });
//   const html = buildLetterHtml(rawHtml);

//   // Coba berbagai kemungkinan path Chrome
//   const possiblePaths = [
//     // Puppeteer cache paths
//     ...(() => {
//       const home = process.env.HOME || "/home/runner";
//       const paths = [];
//       for (const cacheRoot of [path.join(home, ".cache", "puppeteer", "chrome"), path.join("/root", ".cache", "puppeteer", "chrome")]) {
//         try {
//           if (fs.existsSync(cacheRoot)) {
//             const versions = fs.readdirSync(cacheRoot);
//             for (const ver of versions.sort().reverse()) {
//               for (const subDir of ["chrome-linux64", "chrome-linux"]) {
//                 const candidate = path.join(cacheRoot, ver, subDir, "chrome");
//                 if (fs.existsSync(candidate)) paths.push(candidate);
//               }
//             }
//           }
//         } catch {}
//       }
//       return paths;
//     })(),
//     // System paths
//     "/usr/bin/google-chrome-stable",
//     "/usr/bin/google-chrome",
//     "/usr/bin/chromium-browser",
//     "/usr/bin/chromium",
//     "/usr/local/bin/chromium",
//     "/snap/bin/chromium",
//     // Puppeteer executable path
//     (() => {
//       try {
//         const puppeteer = require("puppeteer");
//         return typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
//       } catch { return undefined; }
//     })(),
//   ].filter(Boolean);

//   const executablePath = possiblePaths.find(p => p && fs.existsSync(p));
  
//   if (!executablePath) {
//     // Fallback: kirim HTML saja jika Chrome tidak tersedia
//     console.warn("Chrome tidak ditemukan, mengirim HTML sebagai fallback");
//     const htmlBuffer = Buffer.from(html, "utf-8");
//     return htmlBuffer;
//   }
  
//   const puppeteer = require("puppeteer");
//   const browser = await puppeteer.launch({
//     executablePath,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage",
//       "--disable-gpu",
//       "--disable-software-rasterizer",
//       "--disable-web-security",
//       "--disable-features=IsolateOrigins,site-per-process"
//     ],
//     headless: true,
//   });
  
//   try {
//     const page = await browser.newPage();
//     await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
//     const pdfUint8 = await page.pdf({ 
//       format: "A4", 
//       printBackground: true,
//       margin: { top: "2.5cm", bottom: "2.5cm", left: "2.5cm", right: "2.5cm" }
//     });
//     return Buffer.from(pdfUint8);
//   } finally {
//     await browser.close();
//   }
// }
async function convertDocxToPdf(docxBuffer: Buffer, title = "Surat"): Promise<Buffer> {
  // Coba LibreOffice dulu (akurasi tinggi, mendukung semua formatting DOCX)
  const loPdf = await convertWithLibreOffice(docxBuffer);
  if (loPdf) {
    console.log(`[PDF] Menggunakan LibreOffice untuk konversi: ${title}`);
    return loPdf;
  }
  console.log(`[PDF] LibreOffice tidak tersedia, fallback ke mammoth+puppeteer: ${title}`);

  const mammoth = require("mammoth");
  const PizZip = require("pizzip");

  // Extract document XML untuk mendapatkan margin yang tepat
  const zip = new PizZip(docxBuffer);
  const documentXml = zip.files["word/document.xml"]?.asText() ?? "";
  const stylesXml = zip.files["word/styles.xml"]?.asText() ?? "";

  // ==================== EXTRACT MARGIN ====================
  // Konversi twips (1/20 point) ke cm
  const twipsToCm = (twips: string) => {
    const value = parseInt(twips);
    return (value / 20 / 72 * 2.54).toFixed(2) + "cm";
  };

  // Default margin untuk surat resmi Indonesia
  let marginTop = "2.54cm";
  let marginBottom = "2.54cm";
  let marginLeft = "3.00cm";    // Lebih besar untuk binding
  let marginRight = "2.54cm";

  // Parse page margins dari DOCX
  const pgMarMatch = documentXml.match(/<w:pgMar\s[^>]*/);
  if (pgMarMatch) {
    const pgMarStr = pgMarMatch[0];
    const topM = pgMarStr.match(/w:top="([^"]+)"/);
    const botM = pgMarStr.match(/w:bottom="([^"]+)"/);
    const lefM = pgMarStr.match(/w:left="([^"]+)"/);
    const rigM = pgMarStr.match(/w:right="([^"]+)"/);
    
    if (topM) marginTop = twipsToCm(topM[1]);
    if (botM) marginBottom = twipsToCm(botM[1]);
    if (lefM) marginLeft = twipsToCm(lefM[1]);
    if (rigM) marginRight = twipsToCm(rigM[1]);
  }

  // ==================== EXTRACT FONT ====================
  let defaultFont = "'Times New Roman', Times, serif";
  let defaultFontSize = "12pt";
  
  // Parse font dari styles
  const fontMatch = stylesXml.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
  if (fontMatch) {
    defaultFont = `'${fontMatch[1]}', ${defaultFont}`;
  }
  
  const fontSizeMatch = stylesXml.match(/<w:sz[^>]*w:val="(\d+)"/);
  if (fontSizeMatch) {
    const halfPoints = parseInt(fontSizeMatch[1]);
    const points = halfPoints / 2;
    defaultFontSize = `${points}pt`;
  }

  // ==================== EXTRACT PARAGRAPH STYLES ====================
  // Parse paragraph properties
  const paragraphStyles: Array<{ align: string; indent: number; spacing: number }> = [];
  const pTagRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  
  while ((pMatch = pTagRegex.exec(documentXml)) !== null) {
    const pXml = pMatch[0];
    
    // Alignment: w:jc val ("both" = justify)
    const jcM = pXml.match(/<w:jc w:val="([^"]+)"/);
    const rawAlign = jcM ? jcM[1] : "";
    const align = rawAlign === "both" ? "justify"
      : rawAlign === "center" ? "center"
      : rawAlign === "right" ? "right"
      : rawAlign === "left" ? "left"
      : "justify";
    
    // First line indent in twips → cm
    const indentM = pXml.match(/<w:ind[^>]*w:firstLine="([^"]+)"/);
    const indent = indentM ? (parseInt(indentM[1]) / 20 / 72 * 2.54).toFixed(2) + "cm" : "0cm";
    
    // Space before in twips → cm
    const spacingM = pXml.match(/<w:spacing[^>]*w:before="([^"]+)"/);
    const spacing = spacingM ? (parseInt(spacingM[1]) / 20 / 72 * 2.54).toFixed(2) + "cm" : "0cm";
    
    paragraphStyles.push({ align, indent: parseFloat(indent), spacing: parseFloat(spacing) });
  }

  // ==================== CONVERT TO HTML ====================
  const { value: rawHtml } = await mammoth.convertToHtml({
    buffer: docxBuffer,
    convertImage: mammoth.images.imgElement(function(image: any) {
      return image.read("base64").then(function(imageBuffer: string) {
        return { src: `data:${image.contentType};base64,${imageBuffer}` };
      });
    }),
    styleMap: [
      "p[style-name='Normal'] => p:fresh",
      "p[style-name='Body Text'] => p:fresh",
      "u => u",
      "b => strong",
      "i => em",
    ],
  });

  // ==================== BUILD FINAL HTML ====================
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    @page {
      size: A4;
      margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft};
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${defaultFont};
      font-size: ${defaultFontSize};
      line-height: 1.5;
      color: #000000;
      background: white;
    }
    
    /* Kop surat container */
    .letter-header {
      text-align: center;
      margin-bottom: 24pt;
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12pt;
      border-bottom: 2px solid #000000;
      padding-bottom: 12pt;
    }
    
    .header-logo img {
      max-width: 80px;
      height: auto;
    }
    
    .header-text {
      text-align: center;
    }
    
    .header-text h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0;
      text-transform: uppercase;
    }
    
    .header-text h2 {
      font-size: 12pt;
      font-weight: bold;
      margin: 4pt 0;
    }
    
    .header-text p {
      font-size: 10pt;
      margin: 2pt 0;
      text-align: center;
    }
    
    /* Alamat tujuan */
    .recipient {
      margin: 24pt 0 16pt;
    }
    
    .recipient p {
      margin: 2pt 0;
      text-indent: 0;
    }
    
    /* Nomor surat */
    .letter-number {
      text-align: center;
      margin: 20pt 0;
    }
    
    .letter-number p {
      font-weight: bold;
      text-decoration: underline;
      margin: 0;
      text-indent: 0;
    }
    
    /* Body text */
    .letter-body p {
      margin: 0 0 8pt;
      text-indent: 1.27cm; /* Standard indent 0.5 inch */
      text-align: justify;
    }
    
    .letter-body p.no-indent {
      text-indent: 0;
    }
    
    /* Table styling (untuk alamat) */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
    }
    
    td {
      border: none;
      padding: 2pt 4pt;
      vertical-align: top;
    }
    
    /* Signature section */
    .signature {
      margin-top: 48pt;
      text-align: right;
    }
    
    .signature p {
      margin: 4pt 0;
      text-indent: 0;
    }
    
    .signature-name {
      margin-top: 24pt;
      font-weight: bold;
    }
    
    .signature-image {
      max-width: 150px;
      height: auto;
      margin: 8pt 0;
    }
    
    /* Carbon copy */
    .carbon-copy {
      margin-top: 32pt;
      font-size: 10pt;
    }
    
    .carbon-copy p {
      margin: 2pt 0;
      text-indent: 0;
    }
    
    .carbon-copy ol, .carbon-copy ul {
      margin: 4pt 0 4pt 24pt;
    }
    
    .carbon-copy li {
      margin: 2pt 0;
    }
    
    /* Bold and underline */
    strong, b {
      font-weight: bold;
    }
    
    u {
      text-decoration: underline;
    }
    
    /* Center alignment */
    .center {
      text-align: center;
    }
    
    /* Clearfix */
    .clearfix::after {
      content: "";
      clear: both;
      display: table;
    }
  </style>
</head>
<body>
  <div class="letter-body">
    ${rawHtml}
  </div>
</body>
</html>`;

  // ==================== GENERATE PDF ====================
  const executablePath = findChromePath();
  if (!executablePath) {
    console.warn("Chrome tidak ditemukan, mengirim HTML sebagai fallback");
    return Buffer.from(html, "utf-8");
  }

  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-web-security",
      "--font-render-hinting=none",
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport ke ukuran A4
    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    });
    
    await page.setContent(html, { 
      waitUntil: "networkidle0", 
      timeout: 30000 
    });
    
    // Tunggu font dan gambar terload
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(resolve);
        } else {
          setTimeout(resolve, 1000);
        }
      });
    });
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: marginTop,
        bottom: marginBottom,
        left: marginLeft,
        right: marginRight,
      },
      preferCSSPageSize: true,
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

async function convertDocxToHtml(docxBuffer: Buffer): Promise<string> {
  const mammoth = require("mammoth");
  const { value: rawHtml } = await mammoth.convertToHtml({
    buffer: docxBuffer,
    convertImage: mammoth.images.imgElement(function(image: any) {
      return image.read("base64").then(function(imageBuffer: string) {
        return { src: `data:${image.contentType};base64,${imageBuffer}` };
      });
    }),
    styleMap: [
      "p[style-name='Normal'] => p:fresh",
      "p[style-name='Body Text'] => p:fresh",
      "u => u",
      "b => strong",
      "i => em",
    ],
  });
  return buildLetterHtml(rawHtml);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Serve uploads
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  }, express.static(uploadDir));

  // ─── Auth Routes ────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
      const user = await db.getUserByUsername(username) || await db.getUserByEmail(username);
      if (!user || !user.isActive) return res.status(401).json({ error: "Username atau password salah" });
      if (!verifyPassword(password, user.password)) return res.status(401).json({ error: "Username atau password salah" });
      const accessToken  = signToken({ id: user.id, username: user.username, role: user.role });
      const refreshToken = generateRefreshToken();
      const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.createRefreshToken(user.id, refreshToken, expiresAt);
      await db.deleteExpiredRefreshTokens().catch(() => {});
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ token: accessToken, refresh_token: refreshToken, user: userWithoutPassword });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: any, res) => {
    try {
      const user = await db.getUser(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Auth: Forgot Password / OTP ────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email wajib diisi" });
      const user = await db.getUserByEmail(email);
      if (user && user.email) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await db.deleteOtpForUser(user.id);
        await db.createOtp(user.id, otp, expiresAt);
        const { sendOtpResetEmail } = await import("./email");
        await sendOtpResetEmail(user.email, otp, user.fullName || user.username).catch(console.error);
      }
      return res.json({ ok: true, message: "Jika email terdaftar, kode OTP telah dikirim" });
    } catch (e: any) { return routeError(res, e); }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: "Email dan OTP wajib diisi" });
      const user = await db.getUserByEmail(email);
      if (!user) return res.status(400).json({ error: "OTP tidak valid atau sudah kedaluwarsa" });
      const record = await db.getOtp(user.id);
      if (!record) return res.status(400).json({ error: "OTP tidak valid atau sudah kedaluwarsa" });
      if (new Date(record.expiresAt) < new Date()) {
        await db.deleteOtpForUser(user.id);
        return res.status(400).json({ error: "OTP sudah kedaluwarsa" });
      }
      if (record.otp !== String(otp)) return res.status(400).json({ error: "OTP salah" });
      await db.markOtpVerified(record.id);
      const jwt = (await import("jsonwebtoken")).default;
      const resetToken = jwt.sign(
        { userId: user.id, purpose: "reset-password" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "15m" }
      );
      return res.json({ ok: true, reset_token: resetToken });
    } catch (e: any) { return routeError(res, e); }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { reset_token, new_password } = req.body;
      if (!reset_token || !new_password) return res.status(400).json({ error: "Token dan password baru wajib diisi" });
      const jwt = (await import("jsonwebtoken")).default;
      let payload: any;
      try { payload = jwt.verify(reset_token, process.env.JWT_SECRET || "secret"); }
      catch { return res.status(400).json({ error: "Token tidak valid atau sudah kedaluwarsa" }); }
      if (payload.purpose !== "reset-password") return res.status(400).json({ error: "Token tidak valid" });
      if (new_password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
      await db.updateUser(payload.userId, { password: hashPassword(new_password) });
      await db.deleteOtpForUser(payload.userId);
      await db.revokeAllRefreshTokensForUser(payload.userId).catch(() => {});
      return res.json({ ok: true, message: "Password berhasil direset" });
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Auth: Change Password ────────────────────────────────────────────────────
  app.post("/api/admin/auth/change-password", authMiddleware, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru wajib diisi" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password baru minimal 6 karakter" });
      const user = await db.getUser(req.user.id);
      if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
      if (!verifyPassword(currentPassword, user.password)) return res.status(400).json({ error: "Password lama salah" });
      await db.updateUser(req.user.id, { password: hashPassword(newPassword) });
      return res.json({ ok: true, message: "Password berhasil diubah" });
    } catch (e: any) { return routeError(res, e, "mengubah password"); }
  });

  // ─── Auth: Refresh Token ─────────────────────────────────────────────────────
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) return res.status(400).json({ error: "Refresh token diperlukan" });
      const record = await db.getRefreshToken(refresh_token);
      if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
        return res.status(401).json({ error: "Refresh token tidak valid atau sudah kedaluwarsa" });
      }
      const user = await db.getUser(record.user_id);
      if (!user || !user.isActive) return res.status(401).json({ error: "Akun tidak aktif" });
      const accessToken = signToken({ id: user.id, username: user.username, role: user.role });
      return res.json({ token: accessToken });
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Auth: Logout ────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { refresh_token } = req.body;
      if (refresh_token) await db.revokeRefreshToken(refresh_token).catch(() => {});
      return res.json({ ok: true });
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Admin: Users ───────────────────────────────────────────────────────────
  app.get("/api/admin/users", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const users = await db.listUsers();
      return res.json(users.map(({ password: _, ...u }) => u));
    } catch (e: any) { return routeError(res, e); }
  });

  app.post("/api/admin/users", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const { username, email, password, fullName, role } = req.body;
      const user = await db.createUser({ username, email, password: hashPassword(password), fullName, role, isActive: true });
      const { password: _, ...u } = user;
      return res.json(u);
    } catch (e: any) { return routeError(res, e); }
  });

  app.patch("/api/admin/users/:id", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const { password, ...rest } = req.body;
      const data: any = { ...rest };
      if (password) data.password = hashPassword(password);
      const user = await db.updateUser(req.params.id, data);
      const { password: _, ...u } = user;
      return res.json(u);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/admin/dashboard", authMiddleware, async (req, res) => {
    try {
      const stats = await db.getDashboardStats();
      return res.json(stats);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── News Categories ────────────────────────────────────────────────────────
  app.get("/api/news-categories", async (req, res) => {
    try { return res.json(await db.listNewsCategories()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/news-categories", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createNewsCategory(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/news-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.updateNewsCategory(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/news-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteNewsCategory(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── News ───────────────────────────────────────────────────────────────────
  app.get("/api/news", async (req, res) => {
    try {
      const { page = "1", limit = "10", categoryId, search } = req.query as any;
      const result = await db.listNews({ page: +page, limit: +limit, categoryId, search, status: "published" });
      return res.json(result);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/news/:slug", async (req, res) => {
    try {
      const item = await db.getNewsBySlug(req.params.slug);
      if (!item) return res.status(404).json({ error: "Not found" });
      await db.updateNews(item.id, { viewCount: (item.viewCount || 0) + 1 });
      return res.json(item);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/news", authMiddleware, async (req: any, res) => {
    try {
      const { page = "1", limit = "10", categoryId, search, status, trash } = req.query as any;
      
      const sortBy = String(req.query.sortBy || "publishedAt");
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
      const allowedSort = new Set(["title", "publishedAt", "createdAt"]);
      const safeSortBy = allowedSort.has(sortBy) ? sortBy : "publishedAt";
      const result = await db.listNews({ page: +page, limit: +limit, categoryId, search, status, trash: trash === "true", sortBy: safeSortBy, sortDir: sortDir });
      return res.json(result);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/news/:id", authMiddleware, async (req, res) => {
    try {
      const item = await db.getNews(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return routeError(res, e); }
  });

  const newsUpload = getMulter("news", 1);
  app.post("/api/admin/news", authMiddleware, requireRole("super_admin", "admin_bpp"),
    newsUpload.single("featuredImage"), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.file) data.featuredImage = fileUrl("news", req.file.filename);
        if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
        if (data.eventAt) data.eventAt = new Date(data.eventAt);
        data.authorId = req.user.id;
        const item = await db.createNews(data);
        return res.json(item);
      } catch (e: any) { return routeError(res, e); }
    });

  app.patch("/api/admin/news/:id", authMiddleware, requireRole("super_admin", "admin_bpp"),
    newsUpload.single("featuredImage"), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.file) data.featuredImage = fileUrl("news", req.file.filename);
        if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
        if (data.eventAt) data.eventAt = new Date(data.eventAt);
        const item = await db.updateNews(req.params.id, data);
        return res.json(item);
      } catch (e: any) { return routeError(res, e); }
    });

  app.delete("/api/admin/news/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteNews(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/news/:id/restore", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.restoreNews(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/news/:id/toggle-status", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.toggleNewsStatus(req.params.id)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Quill image upload (standalone, before :id routes to avoid conflict)
  const newsImageUpload = getMulter("news", 1);
  app.post("/api/admin/news/upload-image", authMiddleware, newsImageUpload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      return res.json({ url: fileUrl("news", req.file.filename) });
    } catch (e: any) { return routeError(res, e); }
  });

  // News Media
  app.get("/api/admin/news/:id/media", authMiddleware, async (req, res) => {
    try { return res.json(await db.listNewsMedia(req.params.id)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const mediaUpload = getMulter("news-media", 1);
  app.post("/api/admin/news/:id/media", authMiddleware, requireRole("super_admin", "admin_bpp"),
    mediaUpload.single("file"), async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file" });
        const media = await db.createNewsMedia({
          newsId: req.params.id,
          fileUrl: fileUrl("news-media", req.file.filename),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          insertAfterParagraph: +(req.body.insertAfterParagraph || 0),
          sortOrder: +(req.body.sortOrder || 0),
        });
        return res.json(media);
      } catch (e: any) { return routeError(res, e); }
    });

  app.delete("/api/admin/news-media/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const media = await db.deleteNewsMedia(req.params.id);
      if (media?.fileUrl) {
        const filePath = path.join(process.cwd(), media.fileUrl.replace("/uploads", "uploads"));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      return res.json({ ok: true });
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Banners ─────────────────────────────────────────────────────────────────
  app.get("/api/banners/active", async (req, res) => {
    try { return res.json(await db.getActiveBanners()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/banners/:id/track-click", async (req, res) => {
    try { await db.trackBannerClick(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/banners", authMiddleware, async (req, res) => {
    try {
      await db.deactivateExpiredBanners().catch(() => {});
      return res.json(await db.listBanners({ trash: req.query.trash === "true" }));
    }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const bannerUpload = getMulter("banners", 5);
  app.post("/api/admin/banners", authMiddleware, requireRole("super_admin", "admin_bpp"),
    bannerUpload.fields([{ name: "imageDesktop" }, { name: "imageMobile" }]), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.files?.imageDesktop?.[0]) data.imageDesktop = fileUrl("banners", req.files.imageDesktop[0].filename);
        if (req.files?.imageMobile?.[0]) data.imageMobile = fileUrl("banners", req.files.imageMobile[0].filename);
        if (data.startAt && data.startAt !== "") {
          data.startAt = new Date(data.startAt);
          // Check if valid date
          if (isNaN(data.startAt.getTime())) {
            return res.status(400).json({ error: "Format tanggal mulai tidak valid" });
          }
        } else {
          delete data.startAt; // Remove empty values
        }
        
        if (data.endAt && data.endAt !== "") {
          data.endAt = new Date(data.endAt);
          if (isNaN(data.endAt.getTime())) {
            return res.status(400).json({ error: "Format tanggal selesai tidak valid" });
          }
        } else {
          delete data.endAt;
        }
        if (data.startAt && data.endAt && new Date(data.endAt) < new Date(data.startAt)) {
          return res.status(400).json({ error: "Tanggal selesai harus setelah tanggal mulai" });
        }
        data.isActive = data.isActive === "true" || data.isActive === true;
        return res.json(await db.createBanner(data));
      } catch (e: any) { return routeError(res, e); }
    });

  app.patch("/api/admin/banners/:id", authMiddleware, requireRole("super_admin", "admin_bpp"),
    bannerUpload.fields([{ name: "imageDesktop" }, { name: "imageMobile" }]), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.files?.imageDesktop?.[0]) data.imageDesktop = fileUrl("banners", req.files.imageDesktop[0].filename);
        if (req.files?.imageMobile?.[0]) data.imageMobile = fileUrl("banners", req.files.imageMobile[0].filename);
        if (data.startAt && data.startAt !== "") {
          data.startAt = new Date(data.startAt);
          // Check if valid date
          if (isNaN(data.startAt.getTime())) {
            return res.status(400).json({ error: "Format tanggal mulai tidak valid" });
          }
        } else {
          delete data.startAt; // Remove empty values
        }
        
        if (data.endAt && data.endAt !== "") {
          data.endAt = new Date(data.endAt);
          if (isNaN(data.endAt.getTime())) {
            return res.status(400).json({ error: "Format tanggal selesai tidak valid" });
          }
        } else {
          delete data.endAt;
        }
        if (data.startAt && data.endAt && new Date(data.endAt) < new Date(data.startAt)) {
          return res.status(400).json({ error: "Tanggal selesai harus setelah tanggal mulai" });
        }
        if (data.isActive !== undefined) data.isActive = data.isActive === "true" || data.isActive === true;
        return res.json(await db.updateBanner(req.params.id, data));
      } catch (e: any) { return routeError(res, e); }
    });

  app.delete("/api/admin/banners/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteBanner(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── Menus ───────────────────────────────────────────────────────────────────
  app.get("/api/menus", async (req, res) => {
    try {
      const menus = await db.listMenus();
      const result = await Promise.all(menus.map(async (m) => ({
        ...m,
        items: await db.listMenuItems(m.id),
      })));
      return res.json(result);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/menus", authMiddleware, async (req, res) => {
    try {
      const menus = await db.listMenus();
      const result = await Promise.all(menus.map(async (m) => ({
        ...m,
        items: await db.listMenuItems(m.id),
      })));
      return res.json(result);
    } catch (e: any) { return routeError(res, e); }
  });

  app.post("/api/admin/menus", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createMenu(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/menus/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.updateMenu(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/menus/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteMenu(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/menu-items", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createMenuItem(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/menu-items/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.updateMenuItem(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/menu-items/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteMenuItem(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── Document Masters ────────────────────────────────────────────────────────
  app.get("/api/document-kinds", async (_req, res) => {
    try { return res.json(await db.listDocumentKinds()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.post("/api/admin/document-kinds", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createDocumentKind(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/admin/document-kinds/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0] ?? "";
      return res.json(await db.updateDocumentKind(id, req.body));
    }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/admin/document-kinds/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocumentKind(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/document-categories", async (_req, res) => {
    try { 
      return res.json(await db.listDocumentCategories()); 
    }
    catch (e: any) { 
      return res.status(500).json({ error: e.message }); 
    }
  });
  app.post("/api/admin/document-categories", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { 
      const { name, level } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Nama kategori wajib diisi" });
      }
      
      if (!level || level < 1) {
        return res.status(400).json({ error: "Level harus diisi dengan angka minimal 1" });
      }
      
      return res.json(await db.createDocumentCategory({ name, level: parseInt(level) })); 
    }
    catch (e: any) { 
      if (e.message.includes("sudah digunakan")) {
        return res.status(400).json({ error: e.message });
      }
      return res.status(500).json({ error: e.message }); 
    }
  });
  app.patch("/api/admin/document-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { 
      const data: any = {};
      
      if (req.body.name) data.name = req.body.name;
      if (req.body.level) {
        const level = parseInt(req.body.level);
        if (level < 1) {
          return res.status(400).json({ error: "Level harus minimal 1" });
        }
        data.level = level;
      }
      
      return res.json(await db.updateDocumentCategory(req.params.id, data)); 
    }
    catch (e: any) { 
      if (e.message.includes("sudah digunakan")) {
        return res.status(400).json({ error: e.message });
      }
      return res.status(500).json({ error: e.message }); 
    }
  });
  app.delete("/api/admin/document-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocumentCategory(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.post("/api/admin/document-categories/reorder", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Format data tidak valid" });
      }
      
      await db.reorderDocumentCategories(updates);
      return res.json({ ok: true });
    }
    catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/document-types", async (_req, res) => {
    try { return res.json(await db.listDocumentTypes()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.post("/api/admin/document-types", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createDocumentType(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/admin/document-types/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.updateDocumentType(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/admin/document-types/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocumentType(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── Documents ───────────────────────────────────────────────────────────────
  app.get("/api/documents", async (req, res) => {
    try {
      const { page = "1", limit = "10", search, kindId, categoryId, typeId } = req.query as any;
      return res.json(await db.listDocuments({ page: +page, limit: +limit, search, kindId, categoryId, typeId }));
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/documents", authMiddleware, async (req, res) => {
    try {
      const sortBy = String(req.query.sortBy || "publishedAt");
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
      const allowedSort = new Set(["title", "publishedAt", "createdAt"]);
      const safeSortBy = allowedSort.has(sortBy) ? sortBy : "publishedAt";
      const { page = "1", limit = "10", search, trash, kindId, categoryId, typeId } = req.query as any;
      return res.json(await db.listDocuments({ page: +page, limit: +limit, search, trash: trash === "true", kindId, categoryId, typeId, sortBy: safeSortBy, sortDir: sortDir }));
    } catch (e: any) { return routeError(res, e); }
  });

  const docUpload = getMulterUnlimited("documents");
  app.post("/api/admin/documents", authMiddleware, requireRole("super_admin", "admin_bpp"),
    docUpload.single("file"), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.file) data.fileUrl = fileUrl("documents", req.file.filename);
        if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
        return res.json(await db.createDocument(data));
      } catch (e: any) { return routeError(res, e); }
    });

  app.patch("/api/admin/documents/:id", authMiddleware, requireRole("super_admin", "admin_bpp"),
    docUpload.single("file"), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.file) data.fileUrl = fileUrl("documents", req.file.filename);
        if ("publishedAt" in data) {
          data.publishedAt = normalizeDate(data.publishedAt);
        }
        return res.json(await db.updateDocument(req.params.id, data));
      } catch (e: any) { return routeError(res, e); }
    });

  app.delete("/api/admin/documents/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocument(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/documents/:id/restore", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.restoreDocument(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const document = await db.getDocumentById(req.params.id);
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
  
      if (!document.fileUrl) {
        return res.status(400).json({ error: "Document file not available" });
      }
  
      // Increment download count
      await db.incrementDocumentDownload(document.id);
  
      const filePath = path.join(process.cwd(), document.fileUrl.replace("/uploads", "uploads"));
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on server" });
      }
  
      const fileName = path.basename(document.fileUrl);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
  
  // Endpoint untuk tracking download saja (tanpa download file)
  app.post("/api/documents/:id/track-download", async (req, res) => {
    try {
      const document = await db.getDocumentById(req.params.id);
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
  
      await db.incrementDocumentDownload(document.id);
      
      return res.json({ 
        success: true, 
        message: "Download tracked successfully",
        downloadedCount: (document.downloadedCount || 0) + 1
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/users/:userId/downloaded-documents", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { from, to } = req.query as any;
      
      const result = await db.getUserDownloadedDocuments(userId, { from, to });
      
      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("Get user downloaded documents error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve user downloaded documents",
        error: error.message,
      });
    }
  });

  app.get("/api/admin/document-requests", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
      const search = req.query.search as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
  
      const { items, total } = await db.listDocumentRequestsWithDocuments({ page, limit, search, from, to });
  
      return res.json({
        success: true,
        data: {
          items,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get document requests error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve document requests",
        error: error.message,
      });
    }
  });
  
  // Get grouped document requesters (unique users)
  app.get("/api/admin/document-requests/grouped", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
      const search = req.query.search as string | undefined;
      const { items, total } = await db.listDocumentRequestersGrouped({ page, limit, search });
      return res.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / limit) } });
    } catch (e: any) { return routeError(res, e, "memuat daftar pemohon dokumen"); }
  });

  // Get documents for a specific user
  app.get("/api/admin/document-requests/user/:userId", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const result = await db.getUserDocumentDetails(userId);
      return res.json({ success: true, data: result });
    } catch (e: any) { return routeError(res, e, "memuat detail permohonan dokumen"); }
  });

  // Delete all document requests by a user
  app.delete("/api/admin/document-requests/user/:userId", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { userId } = req.params;
      await db.deleteDocumentRequestsByUser(userId);
      return res.json({ success: true, message: "Semua permohonan dokumen pengguna berhasil dihapus" });
    } catch (e: any) { return routeError(res, e, "menghapus permohonan dokumen pengguna"); }
  });

  // Get single document request by ID
  app.get("/api/admin/document-requests/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const request = await db.getDocumentRequestWithDocument(id);
  
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Document request not found",
        });
      }
  
      return res.json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      console.error("Get document request error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve document request",
        error: error.message,
      });
    }
  });
  
  // Delete document request (soft delete)
  app.delete("/api/admin/document-requests/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.deleteDocumentRequest(id);
  
      return res.json({
        success: true,
        message: "Document request deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete document request error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete document request",
        error: error.message,
      });
    }
  });

  // ─── Research Permits ────────────────────────────────────────────────────────
  const permitUpload = getMulter("permits", 40);

  // Public: Submit permit
  app.post("/api/permits", permitUpload.fields([
    { name: "fileIdentity" }, { name: "fileIntroLetter" },
    { name: "fileProposal" }, { name: "fileSocialMedia" }, { name: "fileSurvey" },
  ]), async (req: any, res) => {
    try {
      const data = { ...req.body, email: req.body.emailActive, };
      if (req.files?.fileIdentity?.[0]) data.fileIdentity = fileUrl("permits", req.files.fileIdentity[0].filename);
      if (req.files?.fileIntroLetter?.[0]) data.fileIntroLetter = fileUrl("permits", req.files.fileIntroLetter[0].filename);
      if (req.files?.fileProposal?.[0]) data.fileProposal = fileUrl("permits", req.files.fileProposal[0].filename);
      if (req.files?.fileSocialMedia?.[0]) data.fileSocialMedia = fileUrl("permits", req.files.fileSocialMedia[0].filename);
      if (req.files?.fileSurvey?.[0]) data.fileSurvey = fileUrl("permits", req.files.fileSurvey[0].filename);
      if (data.introLetterDate) data.introLetterDate = new Date(data.introLetterDate);
      data.agreementFinalReport = data.agreementFinalReport === "true";
      const permit = await db.createPermit(data);
      // Buat notifikasi untuk admin RIDA
      db.createNotification({
        type: "new_permit",
        title: "Permohonan Izin Penelitian Baru",
        message: `${permit.fullName} dari ${permit.institution} mengajukan izin penelitian baru.`,
        resourceId: permit.id,
        resourceType: "permit",
        targetRole: "admin_rida",
      }).catch(() => {});
      // Kirim email konfirmasi ke pemohon
      if (permit.email) {
        sendPermitSubmittedEmail({
          to: permit.email,
          fullName: permit.fullName,
          requestNumber: permit.requestNumber,
          institution: permit.institution,
          researchTitle: permit.researchTitle,
        }).catch((err: any) => console.error("Email submit permit failed:", err));
      }
      return res.json(permit);
    } catch (e: any) { return routeError(res, e); }
  });

  // Public: Get permit by email
  app.get("/api/permits/by-email", async (req, res) => {
    try {
      const { email } = req.query as any;
      if (!email) return res.status(400).json({ error: "Email required" });
      return res.json(await db.getPermitByEmail(email));
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/permits/by-number/:number", async (req, res) => {
    try {
      const { number } = req.params;
  
      const pattern = /^[A-Z0-9]{8}$/;

      if (!pattern.test(number)) {
        return res.status(400).json({ error: "Invalid request number format" });
      }
  
      const permit = await db.getPermitByNumber(number);
  
      if (!permit) {
        return res.status(404).json({ error: "Permit not found" });
      }

      const letter = await db.getGeneratedLetter(permit.id);

      // Simplified customer-facing status
      const customerStatus = ((): { label: string; code: string } => {
        if (permit.status === "rejected") return { label: "Ditolak", code: "ditolak" };
        if (permit.status === "sent" || permit.status === "generated_letter") return { label: "Disetujui", code: "disetujui" };
        if (permit.status === "submitted") return { label: "Diajukan", code: "diajukan" };
        return { label: "Dalam Proses", code: "dalam_proses" };
      })();
  
      return res.json({
        ...permit,
        fileUrl: letter?.pdfFileUrl,
        customerStatus,
      });
  
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/permits/:id", async (req, res) => {
    try {
      const p = await db.getPermit(req.params.id);
      if (!p) return res.status(404).json({ error: "Not found" });
      const letter = await db.getGeneratedLetter(p.id);
      return res.json({ ...p, generatedLetter: letter });
    } catch (e: any) { return routeError(res, e); }
  });

  // Admin: List permits
  app.get("/api/admin/permits", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10", status, search } = req.query as any;
      return res.json(await db.listPermits({ page: +page, limit: +limit, status, search }));
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/permits/:id", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const p = await db.getPermit(req.params.id);
      if (!p) return res.status(404).json({ error: "Not found" });
      const history = await db.getPermitHistory(p.id);
      const letter = await db.getGeneratedLetter(p.id);
      return res.json({ ...p, history, generatedLetter: letter });
    } catch (e: any) { return routeError(res, e); }
  });

  app.patch("/api/admin/permits/:id/status", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const { status, note } = req.body;
      const p = await db.updatePermitStatus(req.params.id, status, note, req.user.id);
      // Kirim email notifikasi status (async, non-blocking)
      if (p.email && status !== "submitted") {
        (async () => {
          try {
            let pdfAttachment: Buffer | undefined;
            let pdfFileName: string | undefined;
            // Jika status generated_letter, lampirkan PDF surat yang sudah digenerate
            if (status === "generated_letter") {
              const letter = await (db as any).getGeneratedLetter(p.id);
              if (letter?.fileUrl) {
                const docxPath = path.join(process.cwd(), letter.fileUrl.replace(/^\//, ""));
                if (fs.existsSync(docxPath) && docxPath.endsWith(".docx")) {
                  const docxBuf = fs.readFileSync(docxPath);
                  pdfAttachment = await convertDocxToPdf(docxBuf, `Surat Izin ${p.requestNumber}`);
                  pdfFileName = path.basename(docxPath).replace(".docx", ".pdf");
                }
              }
            }
            await sendPermitStatusEmail({
              to: p.email,
              fullName: p.fullName,
              requestNumber: p.requestNumber,
              status,
              note,
              pdfAttachment,
              pdfFileName,
            });
          } catch (err: any) {
            console.error("Email status permit failed:", err);
          }
        })();
      }
      return res.json(p);
    } catch (e: any) { return routeError(res, e); }
  });

  // Update permit admin fields (nomor surat, tanggal, penerima, dll.)
  app.patch("/api/admin/permits/:id/detail", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const { issuedLetterNumber, issuedLetterDate, recipientName, recipientCity, researchStartDate, researchEndDate, isSurvei } = req.body;
      const updateData: Record<string, any> = {};
      if (issuedLetterNumber !== undefined) updateData.issuedLetterNumber = issuedLetterNumber || null;
      if (issuedLetterDate !== undefined) updateData.issuedLetterDate = issuedLetterDate ? new Date(issuedLetterDate) : null;
      if (recipientName !== undefined) updateData.recipientName = recipientName || null;
      if (recipientCity !== undefined) updateData.recipientCity = recipientCity || null;
      if (researchStartDate !== undefined) updateData.researchStartDate = researchStartDate ? new Date(researchStartDate) : null;
      if (researchEndDate !== undefined) updateData.researchEndDate = researchEndDate ? new Date(researchEndDate) : null;
      if (isSurvei !== undefined) updateData.isSurvei = Boolean(isSurvei);
      const p = await db.updatePermit(req.params.id, updateData);
      return res.json(p);
    } catch (e: any) { return routeError(res, e); }
  });

  // Toggle isSurvei flag (admin)
  app.patch("/api/admin/permits/:id/is-survei", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const { isSurvei } = req.body;
      if (typeof isSurvei !== "boolean") return res.status(400).json({ error: "isSurvei harus boolean" });
      const p = await db.updatePermit(req.params.id, { isSurvei });
      return res.json(p);
    } catch (e: any) { return routeError(res, e); }
  });

  // Generate letter HTML
  app.post("/api/admin/permits/:id/generate-letter", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const permit = await db.getPermit(req.params.id);
      if (!permit) return res.status(404).json({ error: "Not found" });
      const templates = await db.listTemplates();
      const template = templates[0];
      if (!template) return res.status(400).json({ error: "No template found" });
      let html = template.content
        .replace(/{{request_number}}/g, permit.requestNumber)
        .replace(/{{full_name}}/g, permit.fullName)
        .replace(/{{nim_nik}}/g, permit.nimNik)
        .replace(/{{institution}}/g, permit.institution)
        .replace(/{{research_title}}/g, permit.researchTitle)
        .replace(/{{research_location}}/g, permit.researchLocation)
        .replace(/{{research_duration}}/g, permit.researchDuration)
        .replace(/{{date}}/g, new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }))
        .replace(/{{signer_name}}/g, "Kepala BAPPERIDA Prov. Kalteng");
      const letterDir = path.join(uploadDir, "letters");
      if (!fs.existsSync(letterDir)) fs.mkdirSync(letterDir, { recursive: true });
      const fileName = `${permit.requestNumber.replace(/\//g, "-")}.html`;
      fs.writeFileSync(path.join(letterDir, fileName), html);
      const fileUrl2 = `/uploads/letters/${fileName}`;
      const letter = await db.createGeneratedLetter({ permitId: permit.id, templateId: template.id, fileUrl: fileUrl2 });
      await db.updatePermitStatus(permit.id, "generated_letter", "Surat izin berhasil digenerate", req.user.id);
      return res.json({ letter, html });
    } catch (e: any) { return routeError(res, e); }
  });

  // Multer untuk menerima template DOCX langsung dari frontend
  const tempTemplateUpload = getMulterDocx("temp-templates", 5);

  app.post(
    "/api/admin/permits/:id/generate-letter-docx",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    tempTemplateUpload.single("template"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
    
        let templateBuffer: Buffer;
        let templateSourceName: string;
    
        if (req.file) {
          templateBuffer = fs.readFileSync(req.file.path);
          templateSourceName = req.file.originalname;
          fs.unlinkSync(req.file.path);
        } else if (req.body.templateId) {
          const templateFiles = await db.listLetterTemplateFiles(req.body.templateId);
          const templateFile = templateFiles.find((f) => f.fileUrl.endsWith(".docx"));
          if (!templateFile) {
            return res.status(400).json({ error: "Template DOCX tidak ditemukan di database" });
          }
          const templatePath = path.join(process.cwd(), templateFile.fileUrl.replace("/uploads", "uploads"));
          if (!fs.existsSync(templatePath)) {
            return res.status(400).json({ error: "File template tidak ada di disk" });
          }
          templateBuffer = fs.readFileSync(templatePath);
          templateSourceName = templateFile.fileName;
        } else {
          return res.status(400).json({ error: "Kirim file template (.docx) atau sertakan templateId" });
        }
    
        let templateConfig: any = null;
        if (req.body.templateId) {
          templateConfig = await db.getTemplate(req.body.templateId);
        }
    
        // Generate DOCX dari template
        const replacements = buildLetterReplacements(permit, templateConfig);
        const docxBuffer = generateDocxFromBuffer(templateBuffer, replacements);
    
        // Siapkan folder untuk menyimpan file
        const letterDir = path.join(uploadDir, "letters");
        if (!fs.existsSync(letterDir)) fs.mkdirSync(letterDir, { recursive: true });
    
        // Buat nama file
        const safeStr = (s: string) => s.replace(/[^a-zA-Z0-9\u00C0-\u024F_\- ]/g, "").trim().replace(/\s+/g, "_");
        const nomorSurat = safeStr(permit.issuedLetterNumber || permit.requestNumber || "BAPPERIDA");
        const namaPemohon = safeStr(permit.fullName || "Pemohon");
        const jenisSurat = templateConfig?.category === "rekomendasi" ? "Surat_Rekomendasi" : "Surat_Izin_Penelitian";
        
        const docxFileName = `${nomorSurat}_${namaPemohon}_${jenisSurat}.docx`;
        const pdfFileName = `${nomorSurat}_${namaPemohon}_${jenisSurat}.pdf`;
        
        const docxFilePath = path.join(letterDir, docxFileName);
        const pdfFilePath = path.join(letterDir, pdfFileName);
        
        // Simpan file DOCX
        fs.writeFileSync(docxFilePath, docxBuffer);
        const generatedFileUrl = `/uploads/letters/${docxFileName}`;
        
        // Generate PDF dari DOCX (WAJIB)
        let pdfFileUrl: string | undefined;
        let pdfBuffer: Buffer | undefined;
        
        try {
          console.log("🔄 Mengkonversi DOCX ke PDF...");
          pdfBuffer = await convertDocxToPdf(docxBuffer, `Surat ${permit.requestNumber}`);
          fs.writeFileSync(pdfFilePath, pdfBuffer);
          pdfFileUrl = `/uploads/letters/${pdfFileName}`;
          console.log(`✅ PDF berhasil dibuat: ${pdfFileName}`);
        } catch (pdfErr: any) {
          console.error("❌ PDF generation failed:", pdfErr);
          // Jika PDF gagal, tetap lanjutkan tapi kirim warning
          // Jangan throw error, karena DOCX tetap tersimpan
        }
    
        // Simpan atau update record di database
        // const existingLetter = await (db as any).getGeneratedLetter(permit.id);
        
        // if (existingLetter) {
        //   // Update existing letter
        //   await db.updateGeneratedLetter(existingLetter.id, {
        //     templateId: req.body.templateId ?? undefined,
        //     fileUrl: generatedFileUrl,
        //     pdfFileUrl: pdfFileUrl || existingLetter.pdfFileUrl,
        //   });
        //   console.log(`✅ Updated existing letter: ${existingLetter.id}`);
        // } else {
        //   // Create new letter
          await db.createGeneratedLetter({
            permitId: permit.id,
            templateId: req.body.templateId ?? undefined,
            fileUrl: generatedFileUrl,
            pdfFileUrl,
          });
          console.log(`✅ Created new letter for permit: ${permit.id}`);
        // }
    
        const isSaveOnly = req.body.saveOnly === "true" || req.body.saveOnly === true;
        
        // Jika saveOnly=true, kembalikan JSON dengan URL file
        if (isSaveOnly) {
          return res.json({ 
            fileUrl: generatedFileUrl, 
            pdfFileUrl, 
            docxFileName,
            pdfFileName,
            hasPdf: !!pdfFileUrl
          });
        }
    
        // Jika download langsung (bukan saveOnly), kirim DOCX
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${docxFileName}"`);
        return res.send(docxBuffer);
    
      } catch (e: any) {
        console.error("DOCX generation error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // ─── Preview surat sebagai PDF (server-side DOCX → PDF) ──────────────────────
  app.post(
    "/api/admin/permits/:id/preview-letter-pdf",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
  
        // Ambil generated letter yang sudah ada
        const letter = await (db as any).getGeneratedLetter(permit.id);
        
        if (!letter?.pdfFileUrl && !letter?.fileUrl) {
          return res.status(400).json({ 
            error: "Surat belum digenerate. Silakan generate surat terlebih dahulu." 
          });
        }
        
        // PRIORITAS: Jika ada PDF, langsung tampilkan
        if (letter?.pdfFileUrl) {
          const pdfPath = path.join(process.cwd(), letter.pdfFileUrl.replace(/^\//, ""));
          if (fs.existsSync(pdfPath)) {
            console.log(`✅ Menampilkan PDF yang sudah ada: ${letter.pdfFileUrl}`);
            const pdfBuf = fs.readFileSync(pdfPath);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${path.basename(pdfPath)}"`);
            return res.send(pdfBuf);
          } else {
            console.warn(`⚠️ File PDF tidak ditemukan di disk: ${pdfPath}`);
          }
        }
        
        // Jika PDF tidak ada, cek apakah ada DOCX (fallback)
        if (letter?.fileUrl) {
          const docxPath = path.join(process.cwd(), letter.fileUrl.replace(/^\//, ""));
          if (fs.existsSync(docxPath) && docxPath.endsWith(".docx")) {
            console.log(`🔄 Konversi ulang DOCX ke PDF: ${docxPath}`);
            const docxBuffer = fs.readFileSync(docxPath);
            
            try {
              const pdfBuffer = await convertDocxToPdf(docxBuffer, `Surat ${permit.requestNumber}`);
              const pdfFileName = path.basename(docxPath).replace(".docx", ".pdf");
              const pdfPath = path.join(path.dirname(docxPath), pdfFileName);
              fs.writeFileSync(pdfPath, pdfBuffer);
              
              // Update database dengan pdfFileUrl
              await db.updateGeneratedLetterPdf(permit.id, `/uploads/letters/${pdfFileName}`);
              
              res.setHeader("Content-Type", "application/pdf");
              res.setHeader("Content-Disposition", `inline; filename="${pdfFileName}"`);
              return res.send(pdfBuffer);
            } catch (pdfErr: any) {
              console.error("❌ PDF conversion failed:", pdfErr);
              return res.status(500).json({ 
                error: `Gagal konversi ke PDF: ${pdfErr.message}`,
                fallback: "Silakan download file DOCX untuk melihat surat"
              });
            }
          }
        }
        
        return res.status(400).json({ error: "File surat tidak ditemukan di server" });
        
      } catch (e: any) {
        console.error("PDF preview error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/permits/:id/download-pdf",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
  
        const letter = await (db as any).getGeneratedLetter(permit.id);
        
        if (!letter?.pdfFileUrl) {
          return res.status(400).json({ error: "File PDF belum tersedia" });
        }
        
        const pdfPath = path.join(process.cwd(), letter.pdfFileUrl.replace(/^\//, ""));
        if (!fs.existsSync(pdfPath)) {
          return res.status(404).json({ error: "File PDF tidak ditemukan di server" });
        }
        
        const pdfBuffer = fs.readFileSync(pdfPath);
        const fileName = path.basename(pdfPath);
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        return res.send(pdfBuffer);
        
      } catch (e: any) {
        console.error("PDF download error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // Upload / overwrite generated letter file (PDF atau DOCX, max 10MB)
  const letterFilesDir = path.join(uploadDir, "letters");
  if (!fs.existsSync(letterFilesDir)) fs.mkdirSync(letterFilesDir, { recursive: true });
  const generatedLetterUpload = multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, letterFilesDir),
      filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== ".pdf" && ext !== ".docx") {
        return cb(new Error("Hanya file PDF atau DOCX yang diizinkan"));
      }
      cb(null, true);
    },
  });
  app.post(
    "/api/admin/permits/:id/upload-generated-letter",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    generatedLetterUpload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded — hanya PDF atau DOCX yang diizinkan" });
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });

        // Terapkan naming convention: {NomorSurat}_{NamaPemohon}_{JenisSurat}.ext
        const safeStr = (s: string) => s.replace(/[^a-zA-Z0-9\u00C0-\u024F_\- ]/g, "").trim().replace(/\s+/g, "_");
        const nomorSurat = safeStr(permit.issuedLetterNumber || permit.requestNumber || "BAPPERIDA");
        const namaPemohon = safeStr(permit.fullName || "Pemohon");
        const jenisSurat = "Surat_Izin_Penelitian";
        const ext = path.extname(req.file.originalname).toLowerCase();
        const finalFileName = `${nomorSurat}_${namaPemohon}_${jenisSurat}${ext}`;
        const oldPath = req.file.path;
        const newPath = path.join(letterFilesDir, finalFileName);
        fs.renameSync(oldPath, newPath);

        const newUrl = `/uploads/letters/${finalFileName}`;
        // Upload manual → simpan ke pdfFileUrl (digunakan sebagai file utama surat)
        await db.updateGeneratedLetterPdf(permit.id, newUrl);
        // Tambah history upload tanpa mengubah status
        await (db as any).addPermitStatusHistory({
          permitId: permit.id,
          fromStatus: permit.status,
          toStatus: permit.status,
          note: `File surat (${ext.replace(".", "").toUpperCase()}) diupload manual oleh admin`,
          changedBy: req.user.id,
        });
        return res.json({ fileUrl: newUrl, pdfFileUrl: newUrl });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // Kirim surat izin via email (status → sent)
  app.post(
    "/api/admin/permits/:id/send-letter",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
        if (!permit.email) return res.status(400).json({ error: "Email pemohon kosong" });

        // Cari file surat yang sudah digenerate
        const letter = await (db as any).getGeneratedLetter(permit.id);
        if (!letter?.fileUrl && !letter?.pdfFileUrl) return res.status(400).json({ error: "Surat belum digenerate" });

        // Tentukan file utama (DOCX atau PDF)
        const mainFileUrl = letter.fileUrl || letter.pdfFileUrl;
        const filePath = path.join(process.cwd(), mainFileUrl.replace(/^\//, ""));
        if (!fs.existsSync(filePath)) return res.status(400).json({ error: "File surat tidak ditemukan di server" });

        const fileName = path.basename(filePath);

        // Generate PDF dari DOCX jika file adalah .docx
        // Gunakan PDF yang sudah tersimpan jika ada
        let pdfBuffer: Buffer | undefined;
        let pdfName: string | undefined;
        if (letter.pdfFileUrl) {
          const savedPdfPath = path.join(process.cwd(), letter.pdfFileUrl.replace(/^\//, ""));
          if (fs.existsSync(savedPdfPath)) {
            pdfBuffer = fs.readFileSync(savedPdfPath);
            pdfName = path.basename(savedPdfPath);
          }
        }
        if (!pdfBuffer && filePath.endsWith(".docx")) {
          try {
            const docxBuf = fs.readFileSync(filePath);
            pdfBuffer = await convertDocxToPdf(docxBuf, `Surat Izin ${permit.requestNumber}`);
            pdfName = fileName.replace(".docx", ".pdf");
          } catch (pdfErr: any) {
            console.warn("PDF generation for email failed, sending DOCX instead:", pdfErr.message);
          }
        }
        // Jika file utama adalah PDF, kirim langsung
        if (!pdfBuffer && filePath.endsWith(".pdf")) {
          pdfBuffer = fs.readFileSync(filePath);
          pdfName = fileName;
        }

        await sendPermitLetterEmail({
          to: permit.email,
          fullName: permit.fullName,
          requestNumber: permit.requestNumber,
          filePath,
          fileName,
          pdfBuffer,
          pdfName,
        });

        // Update status ke sent
        await db.updatePermitStatus(permit.id, "sent", "Surat izin berhasil dikirim ke email pemohon", req.user.id);
        return res.json({ ok: true });
      } catch (e: any) {
        console.error("Send letter email error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // Kirim email notifikasi: silahkan ambil surat cap basah di kantor
  app.post(
    "/api/admin/permits/:id/send-email-pickup",
    authMiddleware,
    requireRole("super_admin", "admin_bpp", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
        if (!permit.email) return res.status(400).json({ error: "Email pemohon kosong" });

        await sendPermitPickupEmail({
          to: permit.email,
          fullName: permit.fullName,
          requestNumber: permit.requestNumber,
        });

        await db.updatePermit(permit.id, { isSendData: true } as any);
        return res.json({ ok: true, message: "Email notifikasi ambil surat berhasil dikirim" });
      } catch (e: any) {
        console.error("Send pickup email error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // Kirim email notifikasi: silahkan cek status di web app
  app.post(
    "/api/admin/permits/:id/send-email-check-status",
    authMiddleware,
    requireRole("super_admin", "admin_bpp", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });
        if (!permit.email) return res.status(400).json({ error: "Email pemohon kosong" });

        const webUrl = process.env.WEB_APP_URL || `https://${req.get("host")}`;
        await sendPermitCheckStatusEmail({
          to: permit.email,
          fullName: permit.fullName,
          requestNumber: permit.requestNumber,
          webUrl,
        });

        await db.updatePermit(permit.id, { isSendData: true } as any);
        return res.json({ ok: true, message: "Email notifikasi cek status berhasil dikirim" });
      } catch (e: any) {
        console.error("Send check-status email error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // Generate letter as DOCX - format resmi surat pemerintah
  // app.post("/api/admin/permits/:id/generate-letter-docx", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
  //   try {
  //     const permit = await db.getPermit(req.params.id);
  //     if (!permit) return res.status(404).json({ error: "Not found" });
  
  //     // Dapatkan template yang dipilih dari request body
  //     const { templateId } = req.body;
      
  //     // Cari template file
  //     let templateFile = null;
  //     if (templateId) {
  //       const templateFiles = await db.listLetterTemplateFiles(templateId);
  //       templateFile = templateFiles.find(f => f.fileUrl.endsWith('.docx'));
  //     }
      
  //     // Jika tidak ada template spesifik, gunakan template default
  //     if (!templateFile) {
  //       const templates = await db.listTemplates();
  //       if (templates.length === 0) {
  //         return res.status(400).json({ error: "No template found" });
  //       }
        
  //       // Cari template dengan tipe research_permit
  //       const researchTemplate = templates.find(t => t.type === "research_permit");
  //       const defaultTemplate = researchTemplate || templates[0];
        
  //       const templateFiles = await db.listLetterTemplateFiles(defaultTemplate.id);
  //       templateFile = templateFiles.find(f => f.fileUrl.endsWith('.docx'));
        
  //       if (!templateFile) {
  //         return res.status(400).json({ error: "No DOCX template file found" });
  //       }
  //     }
  
  //     // Path ke file template
  //     const templatePath = path.join(process.cwd(), templateFile.fileUrl.replace("/uploads", "uploads"));
      
  //     if (!fs.existsSync(templatePath)) {
  //       return res.status(400).json({ error: "Template file not found on disk" });
  //     }
  
  //     const now = new Date();
  //     const dateStr = now.toLocaleDateString("id-ID", { 
  //       day: "numeric", 
  //       month: "long", 
  //       year: "numeric" 
  //     }).toUpperCase();
      
  //     const endDate = new Date(now);
  //     endDate.setMonth(endDate.getMonth() + 1);
  //     const endDateStr = endDate.toLocaleDateString("id-ID", { 
  //       day: "numeric", 
  //       month: "long", 
  //       year: "numeric" 
  //     }).toUpperCase();
  
  //     // Data untuk template
  //     const templateData = {
  //       request_number: permit.requestNumber,
  //       full_name: permit.fullName,
  //       nim_nik: permit.nimNik,
  //       institution: permit.institution,
  //       research_title: permit.researchTitle,
  //       research_location: permit.researchLocation,
  //       research_duration: permit.researchDuration,
  //       date: dateStr,
  //       end_date: endDateStr,
  //       signer_name: "Kepala BAPPERIDA Prov. Kalteng",
  //       signer_position: "Kepala BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH",
  //       signer_nip: "197412232000031002",
  //       signer_rank: "Pembina Tk.I",
  //       current_year: now.getFullYear().toString(),
  //       current_month: now.toLocaleDateString("id-ID", { month: "long" }),
  //       current_day: now.getDate().toString(),
  //       // Tambahan data untuk template yang lebih kompleks
  //       intro_letter_number: permit.introLetterNumber || "-",
  //       intro_letter_date: permit.introLetterDate 
  //         ? new Date(permit.introLetterDate).toLocaleDateString("id-ID", { 
  //             day: "numeric", 
  //             month: "long", 
  //             year: "numeric" 
  //           })
  //         : "-",
  //       birth_place: permit.birthPlace || "-",
  //       phone_wa: permit.phoneWa || "-",
  //       citizenship: permit.citizenship || "Indonesia",
  //       work_unit: permit.workUnit || "-",
  //       signer_position_detail: permit.signerPosition || "Kepala BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH",
  //     };
  
  //     // Generate DOCX dengan template
  //     const buffer = await generateDocxFromTemplate(templatePath, templateData);
  
  //     // Simpan file yang digenerate
  //     const letterDir = path.join(uploadDir, "letters");
  //     if (!fs.existsSync(letterDir)) fs.mkdirSync(letterDir, { recursive: true });
      
  //     const fileName = `${permit.requestNumber.replace(/\//g, "-")}-${Date.now()}.docx`;
  //     const filePath = path.join(letterDir, fileName);
  //     fs.writeFileSync(filePath, buffer);
      
  //     const fileUrl2 = `/uploads/letters/${fileName}`;
  
  //     // Simpan ke database
  //     if (templateFile.templateId) {
  //       await db.createGeneratedLetter({ 
  //         permitId: permit.id, 
  //         templateId: templateFile.templateId, 
  //         fileUrl: fileUrl2 
  //       });
  //     }
  
  //     await db.updatePermitStatus(permit.id, "generated_letter", "Surat izin DOCX berhasil digenerate", req.user.id);
  
  //     // Kirim file sebagai response
  //     res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  //     res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  //     return res.send(buffer);
  //   } catch (e: any) {
  //     console.error("DOCX generation error:", e);
  //     return res.status(500).json({ error: e.message });
  //   }
  // });  

  function fillTemplate(html: string, permit: any) {
    const dateStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  
    return html
      .replace(/{{request_number}}/g, permit.requestNumber ?? "")
      .replace(/{{full_name}}/g, permit.fullName ?? "")
      .replace(/{{nim_nik}}/g, permit.nimNik ?? "")
      .replace(/{{institution}}/g, permit.institution ?? "")
      .replace(/{{research_title}}/g, permit.researchTitle ?? "")
      .replace(/{{research_location}}/g, permit.researchLocation ?? "")
      .replace(/{{research_duration}}/g, permit.researchDuration ?? "")
      .replace(/{{date}}/g, dateStr)
      .replace(/{{signer_name}}/g, "Kepala BAPPERIDA Prov. Kalteng");
  }

  async function renderPdfFromHtml(html: string): Promise<Buffer> {
    const executablePath = findChromePath();
    if (!executablePath) {
      throw new Error("Chrome tidak ditemukan di server ini. Jalankan: npx puppeteer browsers install chrome");
    }
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();
    return buffer;
  }

  app.get(
    "/api/admin/permits/:id/letter/preview",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Not found" });
  
        const templates = await db.listTemplates();
        const template = templates[0];
        if (!template) return res.status(400).json({ error: "No template found" });
  
        const html = fillTemplate(template.content, permit);

        try {
          const pdfBuffer = await renderPdfFromHtml(html);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `inline; filename="Preview-${permit.requestNumber}.pdf"`);
          return res.send(pdfBuffer);
        } catch (pdfErr: any) {
          console.warn("Letter preview PDF fallback to HTML:", pdfErr.message);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(html);
        }
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // app.post(
  //   "/api/admin/permits/:id/letter/send-email",
  //   authMiddleware,
  //   requireRole("super_admin", "admin_rida"),
  //   async (req: any, res) => {
  //     try {
  //       const { format = "pdf" } = req.body || {};
  //       const permit = await db.getPermit(req.params.id);
  //       if (!permit) return res.status(404).json({ error: "Not found" });
  //       if (!permit.email) return res.status(400).json({ error: "Permit email empty" });
  
  //       // build attachment buffer + filename
  //       let buffer: Buffer;
  //       let filename: string;
  //       let contentType: string;
  
  //       if (format === "docx") {
  //         // ambil docx existing atau generate
  //         // buffer = ...
  //         // filename = ...
  //         // contentType = ...
  //       } else {
  //         // pdf
  //         const templates = await db.listTemplates();
  //         const template = templates[0];
  //         const html = fillTemplate(template.content, permit);
  //         buffer = await renderPdfFromHtml(html);
  //         filename = `Surat-Izin-${permit.requestNumber}.pdf`;
  //         contentType = "application/pdf";
  //       }
  
  //       await sendMail({
  //         to: permit.email,
  //         subject: `Surat Izin Penelitian - ${permit.requestNumber}`,
  //         text: "Terlampir surat izin penelitian.",
  //         attachments: [{ filename, content: buffer, contentType }],
  //       });
  
  //       // update generated_letters metadata (opsional)
  //       // await db.markLetterSent(...)
  
  //       return res.json({ ok: true });
  //     } catch (e: any) {
  //       return res.status(500).json({ error: e.message });
  //     }
  //   }
  // );

  app.get(
    "/api/admin/permits/:id/letter/download",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const format = String(req.query.format || "pdf"); // pdf|docx
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Not found" });
  
        if (format === "docx") {
          // ✅ kalau kamu mau gunakan generated docx yang sudah ada:
          const letter = await db.getGeneratedLetter(permit.id);
          if (letter?.fileUrl?.endsWith(".docx")) {
            // fileUrl kamu bentuknya /uploads/letters/xxx.docx
            const abs = path.join(uploadDir, letter.fileUrl.replace("/uploads/", "")); // sesuaikan
            if (fs.existsSync(abs)) {
              res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
              res.setHeader("Content-Disposition", `attachment; filename="Surat-Izin-${permit.requestNumber}.docx"`);
              return res.send(fs.readFileSync(abs));
            }
          }
  
          return res.status(400).json({ error: "DOCX belum tergenerate. Silakan generate DOCX dulu." });
        }
  
        // format pdf
        const templates = await db.listTemplates();
        const template = templates[0];
        if (!template) return res.status(400).json({ error: "No template found" });
  
        const html = fillTemplate(template.content, permit);
        const pdfBuffer = await renderPdfFromHtml(html);
  
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Surat-Izin-${permit.requestNumber}.pdf"`);
        return res.send(pdfBuffer);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // ─── Letter Templates ─────────────────────────────────────────────────────────
  app.get("/api/admin/letter-templates", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { 
      
      return res.json(await db.listTemplates()); 
    }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const letterTemplateUpload = getMulter("letter-templates", 5);

  app.post(
    "/api/admin/letter-templates/upload",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    letterTemplateUpload.single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const folder = "letter-templates";

        const url = fileUrl("letter-templates", req.file.filename);

        const path = `${folder}/${req.file.filename}`;

        const templateId = req.body?.templateId;
        if (templateId) {
          await db.createLetterTemplateFile({
            templateId,
            fileUrl: url,
            filePath: path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
          });
        }

        return res.json({ location: url, url });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    },
  );

  app.post(
    "/api/admin/letter-templates/upload-docx",
    authMiddleware,
    requireRole("super_admin", "admin_bpp", "admin_rida"),
    getMulterDocx("letter-templates", 5).single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file" });
  
        const { name, category } = req.body;
  
        // Baca isi XML untuk extract placeholder otomatis
        // Strip XML tags sebelum matching agar placeholder yang terpecah antar XML run tetap terdeteksi
        const zip = new PizZip(fs.readFileSync(req.file.path));
        const docXml = zip.files["word/document.xml"]?.asText() ?? "";
        const plainText = docXml
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        const foundPlaceholders = [...new Set(
          [...plainText.matchAll(/<<([^>]+?)>>/g)].map((m) => `<<${m[1]}>>`)
        )];
  
        // Buat template record
        const template = await db.createTemplate({
          name: name || req.file.originalname.replace(".docx", ""),
          content: "", // Tidak pakai HTML editor, template dari file
          category: category || "surat_izin",
        });
  
        // Simpan file
        const url = fileUrl("letter-templates", req.file.filename);
        const templateFile = await db.createLetterTemplateFile({
          templateId: template.id,
          fileUrl: url,
          filePath: `letter-templates/${req.file.filename}`,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        });
  
        // Update placeholders yang ditemukan ke record template
        await db.updateTemplate(template.id, {
          placeholders: JSON.stringify(foundPlaceholders),
        });
  
        return res.json({
          success: true,
          data: {
            ...template,
            placeholders: foundPlaceholders,
            file: templateFile,
          },
        });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  app.post("/api/admin/letter-templates", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { return res.json(await db.createTemplate(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/letter-templates/:id", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { return res.json(await db.updateTemplate(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // 1. GET files untuk satu template (dipakai PreviewModal)
  app.get(
    "/api/admin/letter-templates/:id/files",
    authMiddleware,
    requireRole("super_admin", "admin_rida", "admin_bpp"),
    async (req, res) => {
      try {
        const files = await db.listLetterTemplateFiles(req.params.id);
        return res.json(files);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );
 
  // 2. DELETE template (dipakai tombol hapus di list)
  app.delete(
    "/api/admin/letter-templates/:id",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req, res) => {
      try {
        // Hapus file fisik terlebih dahulu
        const files = await db.listLetterTemplateFiles(req.params.id);
        for (const f of files) {
          const abs = path.join(
            process.cwd(),
            f.fileUrl.replace("/uploads", "uploads")
          );
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
        // Hapus record (pastikan ada method ini di DatabaseStorage)
        await db.deleteTemplate(req.params.id);
        return res.json({ ok: true });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  app.get(
    "/api/admin/letter-templates/:id",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req, res) => {
      try {
        const item = await db.getTemplate(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        return res.json(item);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    },
  );

  // ─── Surveys ─────────────────────────────────────────────────────────────────
  app.post("/api/surveys", async (req, res) => {
    try {
      const data = req.body;
  
      // =========================
      // 1. NORMALIZE GENDER
      // =========================
      const gender = String(data.gender || "").toLowerCase().trim();
  
      if (!["laki-laki", "perempuan"].includes(gender)) {
        return res.status(400).json({
          error: `Invalid gender: ${data.gender}`,
        });
      }
  
      // =========================
      // 2. MAP ANSWERS (a → 1)
      // =========================
      const ANSWER_MAP: Record<string, number> = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      };
  
      const mappedAnswers: Record<string, number> = {};

      for (let i = 1; i <= 9; i++) {
        const key = `q${i}`;
        const value = data[key];

        if (!(value in ANSWER_MAP)) {
          return res.status(400).json({
            error: `Invalid value for ${key}: ${value}`,
          });
        }

        mappedAnswers[key] = ANSWER_MAP[value];
      }
  
      // =========================
      // 3. BUILD FINAL OBJECT
      // =========================
      const finalData = {
        respondentName: data.respondentName,
        age: Number(data.age),
        gender,
        education: data.education,
        occupation: data.occupation,
        suggestion: data.suggestion || null,
        ...mappedAnswers,
      };
  
      // =========================
      // 4. INSERT
      // =========================
      const result = await db.createSurvey(finalData);

      // Jika ada requestNumber, tandai permit sebagai sudah isi survei
      let updatedPermit = null;
      if (data.requestNumber) {
        try {
          // Cari permit berdasarkan request number
          const linkedPermit = await db.getPermitByNumber(String(data.requestNumber).toUpperCase());
          
          if (linkedPermit) {
            // Update isSurvei menjadi true
            updatedPermit = await db.updatePermit(linkedPermit.id, { isSurvei: true });
            
            console.log(`✅ Survey linked to permit ${linkedPermit.requestNumber}, isSurvei set to true`);
          } else {
            console.log(`⚠️ Permit with request number ${data.requestNumber} not found`);
          }
        } catch (err) {
          console.error("Error updating permit isSurvei:", err);
          // Jangan gagalkan response survey jika update permit gagal
        }
      }

      // Notifikasi ke admin RIDA
      db.createNotification({
        type: "new_survey",
        title: "Survei IKM Baru",
        message: `${finalData.respondentName} mengisi formulir survei kepuasan layanan.`,
        resourceId: (result as any).id,
        resourceType: "survey",
        targetRole: "admin_rida",
      }).catch(() => {});
  
      return res.json({
        success: true,
        message: "Survey berhasil disimpan",
        data: result,
      });
  
    } catch (e: any) {
      return res.status(500).json({
        error: e.message,
      });
    }
  });

  app.get("/api/admin/surveys", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10" } = req.query as any;
      return res.json(await db.listSurveys({ page: +page, limit: +limit }));
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Final Reports ────────────────────────────────────────────────────────────
  const reportUpload = getMulter("reports", 10);
  app.post("/api/final-reports", reportUpload.single("file"), async (req: any, res) => {
    try {
      const data = { ...req.body };
      if (req.file) data.fileUrl = fileUrl("reports", req.file.filename);
      const report = await db.createFinalReport(data);
      // Notifikasi ke admin RIDA
      db.createNotification({
        type: "new_final_report",
        title: "Laporan Akhir Baru",
        message: `${data.fullName || "Pemohon"} mengunggah laporan akhir penelitian.`,
        resourceId: (report as any).id,
        resourceType: "final_report",
        targetRole: "admin_rida",
      }).catch(() => {});
      return res.json(report);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/final-reports", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10" } = req.query as any;
      return res.json(await db.listFinalReports({ page: +page, limit: +limit }));
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Suggestion Box ───────────────────────────────────────────────────────────
  app.post("/api/suggestions", async (req, res) => {
    try { return res.json(await db.createSuggestion(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/suggestions", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10" } = req.query as any;
      return res.json(await db.listSuggestions({ page: +page, limit: +limit }));
    } catch (e: any) { return routeError(res, e); }
  });
  
  app.get("/api/admin/stats/news-views", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      const stats = await db.getNewsViewsStats(year);
      
      // Format untuk chart
      const chartData = stats.map((month: any) => ({
        month: month.month.substring(0, 3), // Jan, Feb, Mar
        views: month.total_views,
        topNews: month.top_news_title ? {
          title: month.top_news_title.length > 20 
            ? month.top_news_title.substring(0, 20) + '...' 
            : month.top_news_title,
          views: month.top_news_views
        } : null
      }));
  
      return res.json({
        monthly: stats,
        chart: chartData
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
  
  app.get("/api/admin/stats/document-downloads", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      const stats = await db.getDocumentDownloadsStats(year);
      
      const chartData = stats.map((month: any) => ({
        month: month.month.substring(0, 3),
        downloads: month.total_downloads,
        topDoc: month.top_doc_title ? {
          title: month.top_doc_title.length > 20 
            ? month.top_doc_title.substring(0, 20) + '...' 
            : month.top_doc_title,
          downloads: month.top_doc_downloads
        } : null
      }));
  
      return res.json({
        monthly: stats,
        chart: chartData
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
  
  app.get("/api/admin/stats/permit-origins", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const stats = await db.getPermitOriginStats(year);
      return res.json(stats);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
  
  // ─── Top Downloaded Documents ─────────────────────────────────────────────────
  app.get("/api/admin/stats/top-documents", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const docs = await db.getTopDocuments(limit);
      return res.json(docs);
    } catch (e: any) { return routeError(res, e, "mengambil data dokumen"); }
  });

  // ─── Available Years for Filter ───────────────────────────────────────────────
  app.get("/api/admin/stats/available-years", authMiddleware, async (req, res) => {
    try {
      const years = await db.getAvailableYears();
      return res.json(years);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Permit Monthly Trend ─────────────────────────────────────────────────────
  app.get("/api/admin/stats/permit-monthly", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const data = await db.getPermitMonthlyStats(year);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── IKM Dashboard Stats ──────────────────────────────────────────────────────
  app.get("/api/admin/stats/ikm-dashboard", authMiddleware, async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

      // Load all surveys via storage layer (no limit = all data)
      const { items: allSurveys } = await db.listSurveys({ limit: 9999 });
      // Filter by year
      const surveys = allSurveys.filter((s: any) => s.createdAt && new Date(s.createdAt).getFullYear() === year);
      const total = surveys.length;

      const questionLabels = [
        "Persyaratan", "Prosedur", "Waktu Pelayanan", "Biaya/Tarif",
        "Produk Layanan", "Kompetensi Pelaksana", "Perilaku Pelaksana",
        "Penanganan Pengaduan", "Sarana & Prasarana",
      ];

      const calcIkm = (s: any) => {
        const qsum = [s.q1,s.q2,s.q3,s.q4,s.q5,s.q6,s.q7,s.q8,s.q9].reduce((a: number, b: number) => a + (Number(b) || 0), 0);
        return qsum / 9;
      };

      // Per-question averages
      const qAvgs = questionLabels.map((label, i) => {
        const key = `q${i + 1}`;
        const avg = total > 0 ? surveys.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0) / total : 0;
        return { question: `Q${i + 1}`, label, avg: parseFloat(avg.toFixed(2)), ikm: parseFloat((avg / 4 * 100).toFixed(1)) };
      });

      // Overall IKM
      const overallIkm = total > 0
        ? parseFloat((qAvgs.reduce((s, q) => s + q.avg, 0) / 9 / 4 * 100).toFixed(1))
        : 0;

      // Monthly trend
      const monthNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const monthlyTrend = monthNames.map((month, i) => {
        const ms = surveys.filter((s: any) => s.createdAt && new Date(s.createdAt).getMonth() === i);
        const mAvg = ms.length > 0 ? ms.reduce((sum: number, s: any) => sum + calcIkm(s), 0) / ms.length : 0;
        return { month, total: ms.length, ikm: parseFloat((mAvg / 4 * 100).toFixed(1)) };
      });

      // Gender / education distribution
      const genderMap: Record<string, number> = {};
      const eduMap: Record<string, number> = {};
      surveys.forEach((s: any) => {
        genderMap[s.gender] = (genderMap[s.gender] || 0) + 1;
        eduMap[s.education] = (eduMap[s.education] || 0) + 1;
      });
      const genderDist = Object.entries(genderMap).map(([name, value]) => ({ name, value }));
      const educationDist = Object.entries(eduMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      // Recent 5
      const recent = surveys.slice(0, 5).map((s: any) => ({
        id: s.id,
        respondentName: s.respondentName,
        age: s.age,
        gender: s.gender,
        education: s.education,
        occupation: s.occupation,
        ikm: parseFloat((calcIkm(s) / 4 * 100).toFixed(1)),
        createdAt: s.createdAt,
      }));

      // Suggestions
      const suggestionResult = await db.listSuggestions({ page: 1, limit: 5 });
      const suggTotal = (await db.listSuggestions({ limit: 9999 })).total;

      return res.json({
        year, total, overallIkm, qAvgs, monthlyTrend, genderDist, educationDist, recent,
        suggestions: { total: suggTotal, recent: suggestionResult.items },
      });
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── PPID Keberatan (Admin) ──────────────────────────────────────────────────
  app.get("/api/admin/ppid/objections", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const page   = parseInt(req.query.page  as string) || 1;
      const limit  = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      return res.json(await db.listPpidObjections({ page, limit, status, search }));
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/ppid/objections/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const item = await db.getPpidObjection(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return routeError(res, e); }
  });

  app.patch("/api/admin/ppid/objections/:id/status", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { status, reviewNote } = req.body;
      if (!status) return res.status(400).json({ error: "Status diperlukan" });
      const updated = await db.updatePpidObjectionStatus(req.params.id, { status, reviewNote, processedBy: req.user.id });
      return res.json(updated);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── PPID Permohonan Informasi (Admin) ───────────────────────────────────────
  app.get("/api/admin/ppid/information-requests", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const page   = parseInt(req.query.page  as string) || 1;
      const limit  = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      return res.json(await db.listPpidInfoRequests({ page, limit, status, search }));
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/ppid/information-requests/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const item = await db.getPpidInfoRequest(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return routeError(res, e); }
  });

  // Upload file response for PPID info request
  const ppidResponseUpload = getMulter("ppid/responses", 10);
  app.patch("/api/admin/ppid/information-requests/:id/status", authMiddleware, requireRole("super_admin", "admin_bpp"),
    ppidResponseUpload.single("responseFile"),
    async (req: any, res) => {
      try {
        const { status, reviewNote } = req.body;
        if (!status) return res.status(400).json({ error: "Status diperlukan" });
        let responseFileUrl: string | undefined;
        if (req.file) {
          responseFileUrl = fileUrl("ppid/responses", req.file.filename);
        }
        const updated = await db.updatePpidInfoRequestStatus(req.params.id, { status, reviewNote, processedBy: req.user.id, responseFileUrl });
        // Kirim email notifikasi ke pemohon
        if (updated.email) {
          let attachmentPath: string | undefined;
          let attachmentName: string | undefined;
          if (responseFileUrl) {
            attachmentPath = path.join(process.cwd(), responseFileUrl.replace(/^\//, ""));
            attachmentName = req.file?.originalname || path.basename(responseFileUrl);
          }
          sendPpidInfoRequestReply({
            to: updated.email,
            fullName: updated.fullName,
            token: updated.token || updated.id.slice(0, 8).toUpperCase(),
            status,
            reviewNote,
            attachmentPath,
            attachmentName,
          }).catch((err: any) => console.error("PPID reply email failed:", err));
        }
        return res.json(updated);
      } catch (e: any) { return routeError(res, e); }
    }
  );

  // ─── Export Excel / CSV ───────────────────────────────────────────────────────
  // Helper: filter by date range from query params
  function filterByDateRange(items: any[], fromStr?: string, toStr?: string) {
    if (!fromStr && !toStr) return items;
    const from = fromStr ? new Date(fromStr) : null;
    const to = toStr ? new Date(toStr + "T23:59:59") : null;
    return items.filter((item: any) => {
      const d = item.createdAt ? new Date(item.createdAt) : null;
      if (!d) return true;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  app.get("/api/admin/export/permits", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listPermits({ limit: 9999 });
      const items = filterByDateRange(all.items, from, to);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Izin Penelitian");
      ws.columns = [
        { header: "No. Permohonan", key: "requestNumber", width: 24 },
        { header: "Nama", key: "fullName", width: 25 },
        { header: "Email", key: "email", width: 28 },
        { header: "NIM/NIK", key: "nimNik", width: 18 },
        { header: "Asal Lembaga", key: "institution", width: 28 },
        { header: "Judul Penelitian", key: "researchTitle", width: 40 },
        { header: "Lokasi", key: "researchLocation", width: 24 },
        { header: "Durasi", key: "researchDuration", width: 16 },
        { header: "Status", key: "status", width: 18 },
        { header: "Tanggal Pengajuan", key: "createdAt", width: 20 },
      ];
      const statusLabel: Record<string,string> = {
        submitted: "Diajukan", in_review: "Dalam Review", revision_requested: "Perlu Revisi",
        approved: "Disetujui", generated_letter: "Surat Dibuat", sent: "Terkirim", rejected: "Ditolak",
      };
      items.forEach((p: any) => {
        ws.addRow({
          ...p,
          status: statusLabel[p.status] || p.status,
          createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString("id-ID") : "",
        });
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="IzinPenelitian-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/export/ppid-objections", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listPpidObjections({ limit: 9999 });
      const items = filterByDateRange(all.items, from, to);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Keberatan PPID");
      ws.columns = [
        { header: "ID", key: "id", width: 36 },
        { header: "Nama", key: "fullName", width: 25 },
        { header: "NIK", key: "nik", width: 18 },
        { header: "Email", key: "email", width: 28 },
        { header: "Telepon", key: "phone", width: 16 },
        { header: "Detail Informasi", key: "informationDetail", width: 40 },
        { header: "Tujuan", key: "requestPurpose", width: 28 },
        { header: "Status", key: "status", width: 16 },
        { header: "Tanggal", key: "createdAt", width: 20 },
      ];
      const statusLabel: Record<string,string> = { pending: "Menunggu", in_review: "Diproses", resolved: "Selesai", rejected: "Ditolak" };
      items.forEach((d: any) => {
        ws.addRow({ ...d, status: statusLabel[d.status] || d.status, createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString("id-ID") : "" });
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="PPID-Keberatan-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/export/ppid-info-requests", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listPpidInfoRequests({ limit: 9999 });
      const items = filterByDateRange(all.items, from, to);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Permohonan Informasi PPID");
      ws.columns = [
        { header: "ID", key: "id", width: 36 },
        { header: "Token", key: "token", width: 18 },
        { header: "Nama", key: "fullName", width: 25 },
        { header: "NIK", key: "nik", width: 18 },
        { header: "Email", key: "email", width: 28 },
        { header: "Telepon", key: "phone", width: 16 },
        { header: "Detail Informasi", key: "informationDetail", width: 40 },
        { header: "Tujuan", key: "requestPurpose", width: 28 },
        { header: "Metode Pengambilan", key: "retrievalMethod", width: 22 },
        { header: "Status", key: "status", width: 16 },
        { header: "Tanggal", key: "createdAt", width: 20 },
      ];
      const statusLabel: Record<string,string> = { pending: "Menunggu", in_review: "Diproses", resolved: "Selesai", rejected: "Ditolak" };
      items.forEach((d: any) => {
        ws.addRow({ ...d, status: statusLabel[d.status] || d.status, createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString("id-ID") : "" });
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="PPID-Permohonan-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Export Berita (News) ─────────────────────────────────────────────────────
  app.get("/api/admin/export/news", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listNews({ limit: 9999, status: undefined });
      const items = filterByDateRange(all.items, from, to);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Berita");
      ws.columns = [
        { header: "Judul", key: "title", width: 50 },
        { header: "Slug", key: "slug", width: 30 },
        { header: "Status", key: "status", width: 14 },
        { header: "Kategori", key: "categoryName", width: 22 },
        { header: "Penulis", key: "authorName", width: 22 },
        { header: "Views", key: "viewCount", width: 10 },
        { header: "Tanggal Publish", key: "publishedAt", width: 20 },
        { header: "Tanggal Buat", key: "createdAt", width: 20 },
      ];
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString("id-ID") : "-";
      items.forEach((n: any) => {
        ws.addRow({ ...n, publishedAt: fmt(n.publishedAt), createdAt: fmt(n.createdAt) });
      });
      // Style header row
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Berita-${new Date().getFullYear()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Export Survey ─────────────────────────────────────────────────────────
  app.get("/api/admin/export/surveys", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listSurveys({ limit: 9999 });
      const data = { items: filterByDateRange(all.items, from, to) };
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Respons Survei");
      ws.columns = [
        { header: "Rating", key: "rating", width: 10 },
        { header: "Komentar", key: "comment", width: 50 },
        { header: "Halaman/Fitur", key: "pageName", width: 25 },
        { header: "Tanggal", key: "createdAt", width: 20 },
      ];
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
      data.items.forEach((s: any) => {
        ws.addRow({ ...s, createdAt: fmt(s.createdAt) });
      });
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Survei-${new Date().getFullYear()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Export Laporan Akhir ──────────────────────────────────────────────────
  app.get("/api/admin/export/final-reports", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const all = await db.listFinalReports({ limit: 9999 });
      const data = { items: filterByDateRange(all.items, from, to) };
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Laporan Akhir");
      ws.columns = [
        { header: "Nomor Permohonan", key: "permitNumber", width: 28 },
        { header: "Nama Peneliti", key: "researcherName", width: 28 },
        { header: "Judul Penelitian", key: "researchTitle", width: 40 },
        { header: "Asal Lembaga", key: "institution", width: 28 },
        { header: "Status", key: "status", width: 16 },
        { header: "Tanggal Laporan", key: "createdAt", width: 20 },
      ];
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString("id-ID") : "-";
      data.items.forEach((r: any) => {
        ws.addRow({ ...r, createdAt: fmt(r.createdAt) });
      });
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="LaporanAkhir-${new Date().getFullYear()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  // ─── Export Survei IKM ────────────────────────────────────────────────────
  app.get("/api/admin/export/ikm-surveys", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to } = req.query as any;
      const { db: rawDb } = await import("./db");
      const schema = await import("../shared/schema");
      const allRows = await rawDb.select().from(schema.surveys).orderBy(schema.surveys.createdAt);
      const rows = filterByDateRange(allRows, from, to);
      const calcIkm = (s: any) => {
        const sum = [s.q1,s.q2,s.q3,s.q4,s.q5,s.q6,s.q7,s.q8,s.q9].reduce((a: number, b: number) => a + (Number(b)||0), 0);
        return parseFloat(((sum / 9) / 4 * 100).toFixed(1));
      };
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Respons Survei IKM");
      ws.columns = [
        { header: "Nama Responden", key: "respondentName", width: 28 },
        { header: "Usia", key: "age", width: 10 },
        { header: "Jenis Kelamin", key: "gender", width: 16 },
        { header: "Pendidikan", key: "education", width: 20 },
        { header: "Pekerjaan", key: "occupation", width: 22 },
        { header: "Q1", key: "q1", width: 8 }, { header: "Q2", key: "q2", width: 8 },
        { header: "Q3", key: "q3", width: 8 }, { header: "Q4", key: "q4", width: 8 },
        { header: "Q5", key: "q5", width: 8 }, { header: "Q6", key: "q6", width: 8 },
        { header: "Q7", key: "q7", width: 8 }, { header: "Q8", key: "q8", width: 8 },
        { header: "Q9", key: "q9", width: 8 },
        { header: "Nilai IKM (%)", key: "ikm", width: 14 },
        { header: "Saran", key: "suggestion", width: 50 },
        { header: "Tanggal", key: "createdAt", width: 20 },
      ];
      const fmt = (d: any) => d ? new Date(d).toLocaleDateString("id-ID") : "-";
      rows.forEach((s: any) => {
        ws.addRow({ ...s, ikm: calcIkm(s), createdAt: fmt(s.createdAt) });
      });
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="SurveiIKM-${new Date().getFullYear()}.xlsx"`);
      await wb.xlsx.write(res);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/export/document-requests", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { from, to, search } = req.query as any;
      
      // Get all document requests with filters (no pagination)
      const allItems = await db.getAllDocumentRequests({ search, from, to });
      
      // Get document titles for each request
      const documentIds = [...new Set(allItems.map(item => item.documentId))];
      let documents: any[] = [];
      if (documentIds.length > 0) {
        documents = await db
          .select({ id: schema.documents.id, title: schema.documents.title })
          .from(schema.documents)
          .where(sql`${schema.documents.id} IN (${documentIds.join(',')})`);
      }
      const documentMap = new Map(documents.map(d => [d.id, d.title]));
      
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Permohonan Dokumen");
      
      // Define columns
      ws.columns = [
        { header: "No", key: "no", width: 8 },
        { header: "ID", key: "id", width: 36 },
        { header: "Nama Pemohon", key: "name", width: 30 },
        { header: "Email", key: "email", width: 30 },
        { header: "No HP", key: "phone", width: 18 },
        { header: "Judul Dokumen", key: "documentTitle", width: 40 },
        { header: "Tujuan Penggunaan", key: "purpose", width: 50 },
        { header: "Tanggal Permohonan", key: "createdAt", width: 20 },
        { header: "Status", key: "status", width: 15 },
      ];
      
      // Style header row
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      
      // Add rows
      let no = 1;
      for (const item of allItems) {
        ws.addRow({
          no: no++,
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          documentTitle: documentMap.get(item.documentId) || '-',
          purpose: item.purpose,
          createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "",
          status: "Aktif",
        });
      }
      
      // Auto-fit columns
      ws.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 10);
      });
      
      // Set response headers
      const fileName = `Permohonan_Dokumen_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      
      await wb.xlsx.write(res);
    } catch (e: any) {
      console.error("Export document requests error:", e);
      return routeError(res, e, "mengekspor data permohonan dokumen");
    }
  });
  
  // Export document requests for a specific user
  app.get("/api/admin/export/document-requests/user/:userId", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const { userId } = req.params;
      const { from, to } = req.query as any;
      
      const { user, documents } = await db.getUserDownloadedDocuments(userId, { from, to });
      
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Permohonan_${user.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
      
      // Add user info header
      ws.mergeCells('A1:F1');
      ws.getCell('A1').value = `LAPORAN PERMOHONAN DOKUMEN`;
      ws.getCell('A1').font = { bold: true, size: 14 };
      ws.getCell('A1').alignment = { horizontal: "center" };
      
      ws.mergeCells('A2:F2');
      ws.getCell('A2').value = `Nama: ${user.name}`;
      ws.getCell('A2').alignment = { horizontal: "center" };
      
      ws.mergeCells('A3:F3');
      ws.getCell('A3').value = `Email: ${user.email}`;
      ws.getCell('A3').alignment = { horizontal: "center" };
      
      if (from || to) {
        ws.mergeCells('A4:F4');
        let dateRange = '';
        if (from && to) dateRange = `${from} s/d ${to}`;
        else if (from) dateRange = `Mulai ${from}`;
        else if (to) dateRange = `Sampai ${to}`;
        ws.getCell('A4').value = `Periode: ${dateRange}`;
        ws.getCell('A4').alignment = { horizontal: "center" };
        ws.getCell('A4').font = { italic: true };
      }
      
      ws.addRow([]); // Empty row
      
      // Define columns
      ws.columns = [
        { header: "No", key: "no", width: 8 },
        { header: "ID Permohonan", key: "requestId", width: 36 },
        { header: "No HP", key: "phone", width: 18 },
        { header: "Judul Dokumen", key: "documentTitle", width: 40 },
        { header: "Tujuan Penggunaan", key: "purpose", width: 50 },
        { header: "Tanggal Permohonan", key: "requestedAt", width: 20 },
      ];
      
      // Style header row
      const headerRowNum = from || to ? 6 : 5;
      const headerRow = ws.getRow(headerRowNum);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      
      // Add rows
      let no = 1;
      for (const doc of documents) {
        ws.addRow({
          no: no++,
          requestId: doc.requestId,
          phone: doc.phone,
          documentTitle: doc.documentTitle,
          purpose: doc.purpose,
          requestedAt: doc.requestedAt ? new Date(doc.requestedAt).toLocaleDateString("id-ID") : "",
        });
      }
      
      // Auto-fit columns
      ws.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 10);
      });
      
      const fileName = `Permohonan_Dokumen_${user.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      
      await wb.xlsx.write(res);
    } catch (e: any) {
      console.error("Export user document requests error:", e);
      return routeError(res, e, "mengekspor data permohonan dokumen user");
    }
  });

  // ─── Notifications API ────────────────────────────────────────────────────────
  app.get("/api/admin/notifications", authMiddleware, async (req: any, res) => {
    try {
      const role = req.user.role;
      const notifications = await db.listNotifications({ targetRole: role, limit: 50 });
      const userId = req.user.id;
      const formatted = notifications.map(n => ({
        ...n,
        isReadByMe: n.readBy ? JSON.parse(n.readBy).includes(userId) : false,
      }));
      return res.json(formatted);
    } catch (e: any) { return routeError(res, e); }
  });

  app.get("/api/admin/notifications/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const count = await db.countUnreadNotifications(req.user.role, req.user.id);
      return res.json({ count });
    } catch (e: any) { return routeError(res, e); }
  });

  app.patch("/api/admin/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
      await db.markNotificationRead(req.params.id, req.user.id);
      return res.json({ ok: true });
    } catch (e: any) { return routeError(res, e); }
  });

  app.patch("/api/admin/notifications/read-all", authMiddleware, async (req: any, res) => {
    try {
      await db.markAllNotificationsRead(req.user.role, req.user.id);
      return res.json({ ok: true });
    } catch (e: any) { return routeError(res, e, "memperbarui notifikasi"); }
  });

  // ─── Broadcast Notification to All Users ─────────────────────────────────────
  app.post("/api/admin/notifications/broadcast", authMiddleware, requireRole("super_admin"), async (req: any, res) => {
    try {
      const { title, message } = req.body;
      if (!title || !message) return res.status(400).json({ error: "Judul dan pesan wajib diisi" });
      await db.createNotification({
        type: "announcement",
        title,
        message,
        targetRole: "all",
        targetUserId: "all",
      });
      return res.json({ ok: true, message: "Notifikasi berhasil dikirim ke semua pengguna" });
    } catch (e: any) { return routeError(res, e, "mengirim notifikasi"); }
  });

  return httpServer;
}
