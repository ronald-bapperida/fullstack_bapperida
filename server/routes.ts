import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage as db } from "./storage";
import { authMiddleware, requireRole, hashPassword, verifyPassword, signToken } from "./auth";
import { randomUUID } from "crypto";
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

// Fungsi untuk generate DOCX dengan docxtemplater
async function generateDocxFromTemplate(
  templatePath: string,
  data: any
): Promise<Buffer> {
  try {
    // Baca file template
    const content = fs.readFileSync(templatePath, "binary");
    
    // Buat instance PizZip
    const zip = new PizZip(content);
    
    // Inisialisasi docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      xmlDom: xmlDom as any,
    });
    
    // Render template dengan data
    doc.render(data);
    
    // Generate buffer
    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    
    return buffer as Buffer;
  } catch (error) {
    console.error("Error generating DOCX:", error);
    throw error;
  }
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
  const newsImageUpload = getMulter("news", 5);
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

  const mediaUpload = getMulter("news-media", 5);
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

  app.post("/api/banners/:id/track-view", async (req, res) => {
    try { await db.trackBannerView(req.params.id); return res.json({ ok: true }); }
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
    try { return res.json(await db.updateDocumentKind(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/admin/document-kinds/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocumentKind(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/document-categories", async (_req, res) => {
    try { return res.json(await db.listDocumentCategories()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.post("/api/admin/document-categories", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.createDocumentCategory(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/admin/document-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { return res.json(await db.updateDocumentCategory(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/admin/document-categories/:id", authMiddleware, requireRole("super_admin", "admin_bpp"), async (req, res) => {
    try { await db.deleteDocumentCategory(req.params.id); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
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

  const docUpload = getMulter("documents", 1000);
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

  // ─── Research Permits ────────────────────────────────────────────────────────
  const permitUpload = getMulter("permits", 10);

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
  
      const pattern = /^BAPPERIDA-RID-\d{4}-\d{6}$/;

      if (!pattern.test(number)) {
        return res.status(400).json({ error: "Invalid request number format" });
      }
  
      const permit = await db.getPermitByNumber(number);
  
      if (!permit) {
        return res.status(404).json({ error: "Permit not found" });
      }
  
      return res.json(permit);
  
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

  // Generate letter as DOCX - format resmi surat pemerintah
  app.post("/api/admin/permits/:id/generate-letter-docx", authMiddleware, requireRole("super_admin", "admin_rida"), async (req: any, res) => {
    try {
      const permit = await db.getPermit(req.params.id);
      if (!permit) return res.status(404).json({ error: "Not found" });
  
      // Dapatkan template yang dipilih dari request body
      const { templateId } = req.body;
      
      // Cari template file
      let templateFile = null;
      if (templateId) {
        const templateFiles = await db.listLetterTemplateFiles(templateId);
        templateFile = templateFiles.find(f => f.fileUrl.endsWith('.docx'));
      }
      
      // Jika tidak ada template spesifik, gunakan template default
      if (!templateFile) {
        const templates = await db.listTemplates();
        if (templates.length === 0) {
          return res.status(400).json({ error: "No template found" });
        }
        
        // Cari template dengan tipe research_permit
        const researchTemplate = templates.find(t => t.type === "research_permit");
        const defaultTemplate = researchTemplate || templates[0];
        
        const templateFiles = await db.listLetterTemplateFiles(defaultTemplate.id);
        templateFile = templateFiles.find(f => f.fileUrl.endsWith('.docx'));
        
        if (!templateFile) {
          return res.status(400).json({ error: "No DOCX template file found" });
        }
      }
  
      // Path ke file template
      const templatePath = path.join(process.cwd(), templateFile.fileUrl.replace("/uploads", "uploads"));
      
      if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: "Template file not found on disk" });
      }
  
      const now = new Date();
      const dateStr = now.toLocaleDateString("id-ID", { 
        day: "numeric", 
        month: "long", 
        year: "numeric" 
      }).toUpperCase();
      
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toLocaleDateString("id-ID", { 
        day: "numeric", 
        month: "long", 
        year: "numeric" 
      }).toUpperCase();
  
      // Data untuk template
      const templateData = {
        request_number: permit.requestNumber,
        full_name: permit.fullName,
        nim_nik: permit.nimNik,
        institution: permit.institution,
        research_title: permit.researchTitle,
        research_location: permit.researchLocation,
        research_duration: permit.researchDuration,
        date: dateStr,
        end_date: endDateStr,
        signer_name: "Kepala BAPPERIDA Prov. Kalteng",
        signer_position: "Kepala BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH",
        signer_nip: "197412232000031002",
        signer_rank: "Pembina Tk.I",
        current_year: now.getFullYear().toString(),
        current_month: now.toLocaleDateString("id-ID", { month: "long" }),
        current_day: now.getDate().toString(),
        // Tambahan data untuk template yang lebih kompleks
        intro_letter_number: permit.introLetterNumber || "-",
        intro_letter_date: permit.introLetterDate 
          ? new Date(permit.introLetterDate).toLocaleDateString("id-ID", { 
              day: "numeric", 
              month: "long", 
              year: "numeric" 
            })
          : "-",
        birth_place: permit.birthPlace || "-",
        phone_wa: permit.phoneWa || "-",
        citizenship: permit.citizenship || "Indonesia",
        work_unit: permit.workUnit || "-",
        signer_position_detail: permit.signerPosition || "Kepala BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH",
      };
  
      // Generate DOCX dengan template
      const buffer = await generateDocxFromTemplate(templatePath, templateData);
  
      // Simpan file yang digenerate
      const letterDir = path.join(uploadDir, "letters");
      if (!fs.existsSync(letterDir)) fs.mkdirSync(letterDir, { recursive: true });
      
      const fileName = `${permit.requestNumber.replace(/\//g, "-")}-${Date.now()}.docx`;
      const filePath = path.join(letterDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      const fileUrl2 = `/uploads/letters/${fileName}`;
  
      // Simpan ke database
      if (templateFile.templateId) {
        await db.createGeneratedLetter({ 
          permitId: permit.id, 
          templateId: templateFile.templateId, 
          fileUrl: fileUrl2 
        });
      }
  
      await db.updatePermitStatus(permit.id, "generated_letter", "Surat izin DOCX berhasil digenerate", req.user.id);
  
      // Kirim file sebagai response
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    } catch (e: any) {
      console.error("DOCX generation error:", e);
      return res.status(500).json({ error: e.message });
    }
  });  

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
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch();
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
  
        const pdfBuffer = await renderPdfFromHtml(html);
  
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="Preview-${permit.requestNumber}.pdf"`);
        return res.send(pdfBuffer);
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

  const letterTemplateUpload = getMulter("letter-templates", 10);

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

  const templateUpload = getMulterDocx("letter-templates");

  app.post(
    "/api/admin/letter-templates/upload-docx",
    authMiddleware,
    requireRole("super_admin", "admin_bpp", "admin_rida"),
    getMulterDocx("letter-templates").single("file"),
    async (req: any, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file" });
  
        const { name, type, isActive } = req.body;
  
        // Buat template record dulu
        const template = await db.createTemplate({
          name: name || "Template Surat Izin Penelitian",
          content: ""
        });
        // Simpan file template
        const url = fileUrl("letter-templates", req.file.filename);
        const path = `letter-templates/${req.file.filename}`;

        const templateFile = await db.createLetterTemplateFile({
          templateId: template.id,
          fileUrl: url,
          filePath: path,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        });
  
        return res.json({ 
          success: true, 
          data: { ...template, file: templateFile }
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

  app.post(
    "/api/admin/letter-templates/:id/test",
    authMiddleware,
    requireRole("super_admin", "admin_rida"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { testData } = req.body;
  
        // Cari template file
        const templateFiles = await db.listLetterTemplateFiles(id);
        const templateFile = templateFiles.find(f => f.fileUrl.endsWith('.docx'));
        
        if (!templateFile) {
          return res.status(400).json({ error: "No DOCX template file found" });
        }
  
        const templatePath = path.join(process.cwd(), templateFile.fileUrl.replace("/uploads", "uploads"));
        
        if (!fs.existsSync(templatePath)) {
          return res.status(400).json({ error: "Template file not found on disk" });
        }
  
        // Data test default
        const defaultTestData = {
          request_number: "BAPPERIDA-RID-2024-000001",
          full_name: "John Doe",
          nim_nik: "1234567890",
          institution: "Universitas Contoh",
          research_title: "Penelitian Contoh",
          research_location: "Palangka Raya",
          research_duration: "3 bulan",
          date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }).toUpperCase(),
          end_date: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }).toUpperCase(),
          signer_name: "Kepala BAPPERIDA Prov. Kalteng",
        };
  
        const dataToUse = testData || defaultTestData;
        
        // Generate DOCX dengan data test
        const buffer = await generateDocxFromTemplate(templatePath, dataToUse);
  
        // Kirim file sebagai response untuk preview
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="test-template-${id}.docx"`);
        return res.send(buffer);
      } catch (e: any) {
        console.error("Template test error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  );

  // ─── Surveys ─────────────────────────────────────────────────────────────────
  app.post("/api/surveys", async (req, res) => {
    try { return res.json(await db.createSurvey(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/surveys", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try {
      const { page = "1", limit = "10" } = req.query as any;
      return res.json(await db.listSurveys({ page: +page, limit: +limit }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ─── Final Reports ────────────────────────────────────────────────────────────
  const reportUpload = getMulter("reports", 1);
  app.post("/api/final-reports", reportUpload.single("file"), async (req: any, res) => {
    try {
      const data = { ...req.body };
      if (req.file) data.fileUrl = fileUrl("reports", req.file.filename);
      return res.json(await db.createFinalReport(data));
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

  return httpServer;
}
