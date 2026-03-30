import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage as db } from "./storage";
import { authMiddleware, requireRole, hashPassword, verifyPassword, signToken } from "./auth";
import { randomUUID } from "crypto";
import {
  sendPermitSubmittedEmail,
  sendPermitStatusEmail,
  sendPermitLetterEmail,
  sendPpidInfoRequestConfirmation,
  sendPpidInfoRequestReply,
} from "./email";
import {
  Document as DocxDocument, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table as DocxTable, TableRow as DocxTableRow,
  TableCell as DocxTableCell, WidthType, ImageRun, UnderlineType,
} from "docx";

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
    .map(line => escapeXml(line.trimEnd()))
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
      // Gunakan escapeXmlWithBreaks agar \n dalam nilai diubah menjadi
      // line-break Word yang valid (<w:br/>) sehingga Enter pada field
      // kepada / tembusan menghasilkan baris baru di dokumen Word.
      const safeValue = escapeXmlWithBreaks(value);
      // Format XML-escaped: &lt;&lt;PLACEHOLDER&gt;&gt;
      const xmlEscaped = `&lt;&lt;${placeholder}&gt;&gt;`;
      xml = xml.split(xmlEscaped).join(safeValue);
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

  const today = new Date();
  const city = template?.city || "Palangka Raya";

  // Format tembusan as numbered list for DOCX (newline-separated entries from template)
  const tembusanRaw: string = template?.tembusan || "";
  const tembusanLines = tembusanRaw
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const tembusanFormatted = tembusanLines.length > 0
    ? tembusanLines.map((line: string, i: number) => `${i + 1}. ${line}`).join("\n")
    : "-";

  return {
    // Dari data permit
    "NAMA":                  permit.fullName         ?? "-",
    "KEPADA":                (permit.recipientName || template?.kepada || permit.fullName) ?? "-",
    "TUJUAN KEPADA":         permit.recipientName    ?? (template?.kepada || permit.fullName) ?? "-",
    "PEJABAT SURAT PENGANTAR": permit.recipientName  ?? "-",
    "NIM":                   permit.nimNik            ?? "-",
    "NIK":                   permit.nimNik            ?? "-",
    "NIM/NIK":               permit.nimNik            ?? "-",
    "TIM SURVEY/PENELITI":   permit.institution      ?? "-",
    "NAMA INSTANSI":         permit.institution      ?? "-",
    "INSTANSI":              permit.institution      ?? "-",
    "JUDUL PENELITIAN":      permit.researchTitle    ?? "-",
    "LOKASI PENELITIAN":     permit.researchLocation ?? "-",
    "DURASI PENELITIAN":     permit.researchDuration ?? "-",
    "NOMOR SURAT PENGANTAR": permit.introLetterNumber ?? "-",
    "NOMOR SURAT":           permit.issuedLetterNumber || permit.introLetterNumber || "-",
    "NOMOR SURAT IZIN":      permit.issuedLetterNumber ?? "-",
    "NOMOR PENGAJUAN":       permit.requestNumber    ?? "-",
    "TANGGAL SURAT PENGANTAR": formatDate(permit.introLetterDate),
    "TANGGAL SURAT":         permit.issuedLetterDate ? formatDate(permit.issuedLetterDate) : formatDate(permit.introLetterDate),
    "TANGGAL SURAT IZIN":    formatDate(permit.issuedLetterDate),
    "TANGGAL PENGAJUAN":     formatDate(permit.createdAt),
    "TANGGAL MULAI PENELITIAN": formatDate(permit.researchStartDate),
    "TANGGAL SELESAI PENELITIAN": formatDate(permit.researchEndDate),
    "TGL SRT DITETAPKAN":    formatDate(permit.issuedLetterDate),
    "TGL MULAI":             formatDate(permit.researchStartDate),
    "TGL SELESAI":           formatDate(permit.researchEndDate),
    "TGL AKHIR":             formatDate(permit.researchEndDate),
    "KOTA PENELITIAN":       permit.recipientCity    ?? city,
    "TANDA TANGAN":          permit.workUnit || permit.institution || "-",
    "TELEPON":               permit.phone            ?? "-",
    "EMAIL":                 permit.email            ?? "-",
    "ALAMAT":                permit.address          ?? "-",
    // Dari config template
    "NAMA PEJABAT":          template?.officialName     ?? "-",
    "JABATAN":               template?.officialPosition ?? "-",
    "JABATAN PEJABAT":       template?.officialPosition ?? "-",
    "NIP":                   template?.officialNip      ?? "-",
    "NIP PEJABAT":           template?.officialNip      ?? "-",
    "KOTA":                  city,
    "TEMBUSAN":              tembusanFormatted,
    // Tanggal otomatis
    "TANGGAL HARI INI":      formatDate(today),
    "TANGGAL":               formatDate(today),
    "TAHUN":                 String(today.getFullYear()),
    "BULAN":                 today.toLocaleDateString("id-ID", { month: "long" }).toUpperCase(),
  };
}


// ─── DOCX → PDF via mammoth + puppeteer ─────────────────────────────────────
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
  @page { size: A4; margin: 2.5cm 3cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; }
  p { margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td, th { padding: 3px 6px; vertical-align: top; }
  img { max-width: 100%; }
  h1,h2,h3,h4 { margin: 8px 0 4px; }
</style></head><body>${rawHtml}</body></html>`;
}

async function convertDocxToPdf(docxBuffer: Buffer, title = "Surat"): Promise<Buffer> {
  const mammoth = require("mammoth");
  const { value: rawHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });
  const html = buildLetterHtml(rawHtml);

  const executablePath = findChromePath();
  if (!executablePath) {
    throw new Error("Chrome tidak ditemukan di server. Pastikan Puppeteer sudah terinstall (jalankan: npx puppeteer browsers install chrome).");
  }
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfUint8 = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return Buffer.from(pdfUint8);
}

async function convertDocxToHtml(docxBuffer: Buffer): Promise<string> {
  const mammoth = require("mammoth");
  const { value: rawHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });
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
      const token = signToken({ id: user.id, username: user.username, role: user.role });
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
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

  // ─── Admin: Users ───────────────────────────────────────────────────────────
  app.get("/api/admin/users", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const users = await db.listUsers();
      return res.json(users.map(({ password: _, ...u }) => u));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/users", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const { username, email, password, fullName, role } = req.body;
      const user = await db.createUser({ username, email, password: hashPassword(password), fullName, role, isActive: true });
      const { password: _, ...u } = user;
      return res.json(u);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/users/:id", authMiddleware, requireRole("super_admin"), async (req, res) => {
    try {
      const { password, ...rest } = req.body;
      const data: any = { ...rest };
      if (password) data.password = hashPassword(password);
      const user = await db.updateUser(req.params.id, data);
      const { password: _, ...u } = user;
      return res.json(u);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/admin/dashboard", authMiddleware, async (req, res) => {
    try {
      const stats = await db.getDashboardStats();
      return res.json(stats);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/news/:slug", async (req, res) => {
    try {
      const item = await db.getNewsBySlug(req.params.slug);
      if (!item) return res.status(404).json({ error: "Not found" });
      await db.updateNews(item.id, { viewCount: (item.viewCount || 0) + 1 });
      return res.json(item);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/news/:id", authMiddleware, async (req, res) => {
    try {
      const item = await db.getNews(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
    });

  app.delete("/api/admin/news-media/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const media = await db.deleteNewsMedia(req.params.id);
      if (media?.fileUrl) {
        const filePath = path.join(process.cwd(), media.fileUrl.replace("/uploads", "uploads"));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    try { return res.json(await db.listBanners({ trash: req.query.trash === "true" })); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const bannerUpload = getMulter("banners", 5);
  app.post("/api/admin/banners", authMiddleware, requireRole("super_admin", "admin_bpp"),
    bannerUpload.fields([{ name: "imageDesktop" }, { name: "imageMobile" }]), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.files?.imageDesktop?.[0]) data.imageDesktop = fileUrl("banners", req.files.imageDesktop[0].filename);
        if (req.files?.imageMobile?.[0]) data.imageMobile = fileUrl("banners", req.files.imageMobile[0].filename);
        if (data.startAt) data.startAt = new Date(data.startAt);
        if (data.endAt) data.endAt = new Date(data.endAt);
        data.isActive = data.isActive === "true" || data.isActive === true;
        return res.json(await db.createBanner(data));
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
    });

  app.patch("/api/admin/banners/:id", authMiddleware, requireRole("super_admin", "admin_bpp"),
    bannerUpload.fields([{ name: "imageDesktop" }, { name: "imageMobile" }]), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.files?.imageDesktop?.[0]) data.imageDesktop = fileUrl("banners", req.files.imageDesktop[0].filename);
        if (req.files?.imageMobile?.[0]) data.imageMobile = fileUrl("banners", req.files.imageMobile[0].filename);
        if (data.startAt) data.startAt = new Date(data.startAt);
        if (data.endAt) data.endAt = new Date(data.endAt);
        if (data.isActive !== undefined) data.isActive = data.isActive === "true" || data.isActive === true;
        return res.json(await db.updateBanner(req.params.id, data));
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/menus", authMiddleware, async (req, res) => {
    try {
      const menus = await db.listMenus();
      const result = await Promise.all(menus.map(async (m) => ({
        ...m,
        items: await db.listMenuItems(m.id),
      })));
      return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/documents", authMiddleware, async (req, res) => {
    try {
      const sortBy = String(req.query.sortBy || "publishedAt");
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
      const allowedSort = new Set(["title", "publishedAt", "createdAt"]);
      const safeSortBy = allowedSort.has(sortBy) ? sortBy : "publishedAt";
      const { page = "1", limit = "10", search, trash, kindId, categoryId, typeId } = req.query as any;
      return res.json(await db.listDocuments({ page: +page, limit: +limit, search, trash: trash === "true", kindId, categoryId, typeId, sortBy: safeSortBy, sortDir: sortDir }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const docUpload = getMulterUnlimited("documents");
  app.post("/api/admin/documents", authMiddleware, requireRole("super_admin", "admin_bpp"),
    docUpload.single("file"), async (req: any, res) => {
      try {
        const data = { ...req.body };
        if (req.file) data.fileUrl = fileUrl("documents", req.file.filename);
        if (data.publishedAt) data.publishedAt = new Date(data.publishedAt);
        return res.json(await db.createDocument(data));
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Public: Get permit by email
  app.get("/api/permits/by-email", async (req, res) => {
    try {
      const { email } = req.query as any;
      if (!email) return res.status(400).json({ error: "Email required" });
      return res.json(await db.getPermitByEmail(email));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
        fileUrl: letter?.fileUrl,
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Admin: List permits
  app.get("/api/admin/permits", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10", status, search } = req.query as any;
      return res.json(await db.listPermits({ page: +page, limit: +limit, status, search }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/permits/:id", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const p = await db.getPermit(req.params.id);
      if (!p) return res.status(404).json({ error: "Not found" });
      const history = await db.getPermitHistory(p.id);
      const letter = await db.getGeneratedLetter(p.id);
      return res.json({ ...p, history, generatedLetter: letter });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Update permit admin fields (nomor surat, tanggal, penerima, dll.)
  app.patch("/api/admin/permits/:id/detail", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const { issuedLetterNumber, issuedLetterDate, recipientName, recipientCity, researchStartDate, researchEndDate } = req.body;
      const updateData: Record<string, any> = {};
      if (issuedLetterNumber !== undefined) updateData.issuedLetterNumber = issuedLetterNumber || null;
      if (issuedLetterDate !== undefined) updateData.issuedLetterDate = issuedLetterDate ? new Date(issuedLetterDate) : null;
      if (recipientName !== undefined) updateData.recipientName = recipientName || null;
      if (recipientCity !== undefined) updateData.recipientCity = recipientCity || null;
      if (researchStartDate !== undefined) updateData.researchStartDate = researchStartDate ? new Date(researchStartDate) : null;
      if (researchEndDate !== undefined) updateData.researchEndDate = researchEndDate ? new Date(researchEndDate) : null;
      const p = await db.updatePermit(req.params.id, updateData);
      return res.json(p);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Multer untuk menerima template DOCX langsung dari frontend
  const tempTemplateUpload = getMulterDocx("temp-templates", 5);

  app.post(
    "/api/admin/permits/:id/generate-letter-docx",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    tempTemplateUpload.single("template"), // field name dari FormData frontend
    async (req: any, res) => {
      try {
        const permit = await db.getPermit(req.params.id);
        if (!permit) return res.status(404).json({ error: "Permit tidak ditemukan" });

        let templateBuffer: Buffer;
        let templateSourceName: string;

        if (req.file) {
          // --- Opsi A: Template dikirim langsung dari frontend ---
          templateBuffer = fs.readFileSync(req.file.path);
          templateSourceName = req.file.originalname;

          // Hapus file temp setelah dibaca
          fs.unlinkSync(req.file.path);

        } else if (req.body.templateId) {
          // --- Opsi B: Gunakan template tersimpan di DB ---
          const templateFiles = await db.listLetterTemplateFiles(req.body.templateId);
          const templateFile = templateFiles.find((f) => f.fileUrl.endsWith(".docx"));
          if (!templateFile) {
            return res.status(400).json({ error: "Template DOCX tidak ditemukan di database" });
          }
          const templatePath = path.join(
            process.cwd(),
            templateFile.fileUrl.replace("/uploads", "uploads")
          );
          if (!fs.existsSync(templatePath)) {
            return res.status(400).json({ error: "File template tidak ada di disk" });
          }
          templateBuffer = fs.readFileSync(templatePath);
          templateSourceName = templateFile.fileName;

        } else {
          return res.status(400).json({
            error: "Kirim file template (.docx) atau sertakan templateId",
          });
        }

        // Fetch template config (for dynamic variables like officialName, tembusan etc.)
        let templateConfig: any = null;
        if (req.body.templateId) {
          templateConfig = await db.getTemplate(req.body.templateId);
        }

        // Build replacements dari data permit + template config
        const replacements = buildLetterReplacements(permit, templateConfig);

        // Generate DOCX
        const outputBuffer = generateDocxFromBuffer(templateBuffer, replacements);

        // Simpan file hasil generate
        const letterDir = path.join(uploadDir, "letters");
        if (!fs.existsSync(letterDir)) fs.mkdirSync(letterDir, { recursive: true });

        // Format nama file: {NomorSuratIzin}_{NamaPemohon}_Jenis Surat.docx
        const safeStr = (s: string) => s.replace(/[^a-zA-Z0-9\u00C0-\u024F_\- ]/g, "").trim().replace(/\s+/g, "_");
        const nomorSurat = safeStr(permit.issuedLetterNumber || permit.requestNumber || "BAPPERIDA");
        const namaPemohon = safeStr(permit.fullName || "Pemohon");
        const jenisSurat = templateConfig?.category === "rekomendasi" ? "Surat_Rekomendasi" : "Surat_Izin_Penelitian";
        const fileName = `${nomorSurat}_${namaPemohon}_${jenisSurat}.docx`;
        const filePath = path.join(letterDir, fileName);
        fs.writeFileSync(filePath, outputBuffer);

        const generatedFileUrl = `/uploads/letters/${fileName}`;

        // Generate PDF dari DOCX (async, tidak block response jika gagal)
        let pdfFileUrl: string | undefined;
        try {
          const pdfBuffer = await convertDocxToPdf(outputBuffer, `Surat ${permit.requestNumber}`);
          const pdfFileName = fileName.replace(/\.docx$/i, ".pdf");
          const pdfFilePath = path.join(letterDir, pdfFileName);
          fs.writeFileSync(pdfFilePath, pdfBuffer);
          pdfFileUrl = `/uploads/letters/${pdfFileName}`;
        } catch (pdfErr: any) {
          console.warn("PDF generation failed (non-fatal):", pdfErr.message);
        }

        // Simpan record ke generated_letters
        await db.createGeneratedLetter({
          permitId: permit.id,
          templateId: req.body.templateId ?? undefined,
          fileUrl: generatedFileUrl,
          pdfFileUrl,
        });

        // Jika saveOnly=true, kembalikan JSON (tidak download, tidak update status)
        // Status diupdate secara manual oleh admin setelah preview
        if (req.body.saveOnly === "true" || req.body.saveOnly === true) {
          return res.json({ fileUrl: generatedFileUrl, pdfFileUrl, fileName });
        }

        // Jika download langsung (bukan saveOnly), tetap tidak auto-update status
        // Admin wajib preview dulu, lalu update status secara manual

        // Kirim file ke browser sebagai download
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        return res.send(outputBuffer);

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

        let docxBuffer: Buffer;
        let baseName: string;

        const { templateId } = req.body;

        if (templateId) {
          // Generate fresh DOCX dari template yang dipilih
          const templateFiles = await db.listLetterTemplateFiles(templateId);
          const templateFile = templateFiles.find((f) => f.fileUrl.endsWith(".docx"));
          if (!templateFile) return res.status(400).json({ error: "Template DOCX tidak ditemukan" });
          const templatePath = path.join(process.cwd(), templateFile.fileUrl.replace(/^\//, ""));
          if (!fs.existsSync(templatePath)) return res.status(400).json({ error: "File template tidak ada di disk" });
          const templateBuf = fs.readFileSync(templatePath);
          const templateConfig = await db.getTemplate(templateId);
          const replacements = buildLetterReplacements(permit, templateConfig);
          docxBuffer = generateDocxFromBuffer(templateBuf, replacements);
          baseName = `BAPPERIDA-${permit.requestNumber.replace(/\//g, "-")}`;
        } else {
          // Pakai file surat yang sudah tersimpan
          const letter = await (db as any).getGeneratedLetter(permit.id);
          if (!letter?.fileUrl && !letter?.pdfFileUrl) return res.status(400).json({ error: "Surat belum digenerate" });

          // Jika PDF sudah tersimpan, serve langsung tanpa konversi ulang
          if (letter?.pdfFileUrl) {
            const pdfPath = path.join(process.cwd(), letter.pdfFileUrl.replace(/^\//, ""));
            if (fs.existsSync(pdfPath)) {
              const pdfBuf = fs.readFileSync(pdfPath);
              res.setHeader("Content-Type", "application/pdf");
              res.setHeader("Content-Disposition", `inline; filename="${path.basename(pdfPath)}"`);
              return res.send(pdfBuf);
            }
          }

          // Fallback: konversi dari DOCX
          if (!letter?.fileUrl) return res.status(400).json({ error: "File surat tidak ada" });
          const filePath = path.join(process.cwd(), letter.fileUrl.replace(/^\//, ""));
          if (!fs.existsSync(filePath)) return res.status(400).json({ error: "File surat tidak ada di disk" });
          docxBuffer = fs.readFileSync(filePath);
          baseName = path.basename(filePath, ".docx");
        }

        // Coba PDF via Chrome; fallback ke HTML jika Chrome tidak ada
        try {
          const pdfBuffer = await convertDocxToPdf(docxBuffer!, `Surat Izin ${permit.requestNumber}`);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `inline; filename="${baseName}.pdf"`);
          return res.send(pdfBuffer);
        } catch (pdfErr: any) {
          console.warn("PDF preview fallback to HTML:", pdfErr.message);
          // Fallback: serve HTML langsung — browser bisa tampilkan & print
          const htmlContent = await convertDocxToHtml(docxBuffer!);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(htmlContent);
        }
      } catch (e: any) {
        console.error("PDF preview error:", e);
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/final-reports", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10" } = req.query as any;
      return res.json(await db.listFinalReports({ page: +page, limit: +limit }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── PPID Keberatan (Admin) ──────────────────────────────────────────────────
  app.get("/api/admin/ppid/objections", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      return res.json(await db.listPpidObjections({ page, limit, status }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/ppid/objections/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const item = await db.getPpidObjection(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/ppid/objections/:id/status", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req: any, res) => {
    try {
      const { status, reviewNote } = req.body;
      if (!status) return res.status(400).json({ error: "Status diperlukan" });
      const updated = await db.updatePpidObjectionStatus(req.params.id, { status, reviewNote, processedBy: req.user.id });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── PPID Permohonan Informasi (Admin) ───────────────────────────────────────
  app.get("/api/admin/ppid/information-requests", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const page  = parseInt(req.query.page  as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      return res.json(await db.listPpidInfoRequests({ page, limit, status }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/ppid/information-requests/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try {
      const item = await db.getPpidInfoRequest(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      return res.json(item);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
      } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/notifications/unread-count", authMiddleware, async (req: any, res) => {
    try {
      const count = await db.countUnreadNotifications(req.user.role, req.user.id);
      return res.json({ count });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/notifications/:id/read", authMiddleware, async (req: any, res) => {
    try {
      await db.markNotificationRead(req.params.id, req.user.id);
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/notifications/read-all", authMiddleware, async (req: any, res) => {
    try {
      await db.markAllNotificationsRead(req.user.role, req.user.id);
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
