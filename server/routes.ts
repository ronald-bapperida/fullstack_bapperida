import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage as db } from "./storage";
import { authMiddleware, requireRole, hashPassword, verifyPassword, signToken } from "./auth";
import { randomUUID } from "crypto";

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

function fileUrl(subdir: string, filename: string) {
  return `/uploads/${subdir}/${filename}`;
}

// ─── Seed DB ──────────────────────────────────────────────────────────────────
async function seedDatabase() {
  const existing = await db.listUsers();
  if (existing.length > 0) return;

  const superAdmin = await db.createUser({
    username: "superadmin",
    email: "superadmin@bapperida.go.id",
    password: hashPassword("Admin@123"),
    fullName: "Super Administrator",
    role: "super_admin",
    isActive: true,
  });

  await db.createUser({
    username: "admin_bpp",
    email: "admin.bpp@bapperida.go.id",
    password: hashPassword("Admin@123"),
    fullName: "Admin BAPPEDA",
    role: "admin_bpp",
    isActive: true,
  });

  await db.createUser({
    username: "admin_rida",
    email: "admin.rida@bapperida.go.id",
    password: hashPassword("Admin@123"),
    fullName: "Admin RIDA",
    role: "admin_rida",
    isActive: true,
  });

  // Seed Categories
  const cat1 = await db.createNewsCategory({ name: "Pembangunan Daerah", slug: "pembangunan-daerah", description: "Berita seputar pembangunan daerah Kalimantan Tengah" });
  const cat2 = await db.createNewsCategory({ name: "Riset & Inovasi", slug: "riset-inovasi", description: "Berita seputar riset dan inovasi daerah" });
  const cat3 = await db.createNewsCategory({ name: "Pengumuman", slug: "pengumuman", description: "Pengumuman resmi dari BAPPERIDA" });

  // Seed News
  await db.createNews({
    title: "BAPPERIDA Kalteng Dorong Inovasi Daerah 2025",
    categoryId: cat2.id,
    content: "<p>BAPPERIDA Kalimantan Tengah terus mendorong inovasi daerah dalam rangka peningkatan pelayanan publik dan pembangunan berkelanjutan. Program unggulan tahun 2025 mencakup digitalisasi layanan, penelitian terapan, dan pengembangan SDM lokal.</p><p>Kepala BAPPERIDA menyampaikan bahwa inovasi daerah merupakan kunci untuk mewujudkan Kalimantan Tengah yang maju dan sejahtera.</p>",
    excerpt: "BAPPERIDA Kalteng terus mendorong inovasi daerah dalam rangka peningkatan pelayanan publik dan pembangunan berkelanjutan.",
    status: "published",
    publishedAt: new Date("2025-01-15"),
    authorId: superAdmin.id,
    eventAt: new Date("2025-01-15"),
  });

  await db.createNews({
    title: "Rapat Koordinasi Perencanaan Pembangunan Kalteng 2025",
    categoryId: cat1.id,
    content: "<p>Rapat koordinasi perencanaan pembangunan Kalimantan Tengah 2025 digelar di Palangka Raya. Pertemuan ini membahas prioritas pembangunan infrastruktur, ekonomi, dan sumber daya manusia.</p>",
    excerpt: "Rapat koordinasi perencanaan pembangunan Kalteng 2025 membahas prioritas infrastruktur dan SDM.",
    status: "published",
    publishedAt: new Date("2025-01-20"),
    authorId: superAdmin.id,
    eventAt: new Date("2025-01-20"),
  });

  await db.createNews({
    title: "Pembukaan Penerimaan Izin Penelitian Tahun 2025",
    categoryId: cat3.id,
    content: "<p>BAPPERIDA RIDA membuka penerimaan permohonan izin penelitian untuk tahun 2025. Peneliti dari berbagai instansi dapat mengajukan permohonan melalui portal digital resmi BAPPERIDA Kalimantan Tengah.</p>",
    excerpt: "BAPPERIDA RIDA membuka penerimaan permohonan izin penelitian 2025 melalui portal digital.",
    status: "published",
    publishedAt: new Date("2025-02-01"),
    authorId: superAdmin.id,
  });

  await db.createNews({
    title: "Draft: Program Kerja BAPPERIDA Semester 2",
    categoryId: cat1.id,
    content: "<p>Draft program kerja BAPPERIDA untuk semester 2 sedang dalam penyusunan.</p>",
    excerpt: "Draft program kerja semester 2.",
    status: "draft",
    authorId: superAdmin.id,
  });

  // Seed Banner
  await db.createBanner({
    title: "Selamat Datang di Portal BAPPERIDA Kalteng",
    placement: "home",
    linkType: "external",
    linkUrl: "https://bapperida.kalteng.go.id",
    isActive: true,
    startAt: new Date("2025-01-01"),
    endAt: new Date("2025-12-31"),
  });

  // Seed Menu
  const mainMenu = await db.createMenu({ name: "Menu Utama", location: "mobile", isActive: true });
  await db.createMenuItem({ menuId: mainMenu.id, title: "Beranda", type: "route", value: "/", sortOrder: 1, requiresAuth: false });
  await db.createMenuItem({ menuId: mainMenu.id, title: "Berita", type: "route", value: "/berita", sortOrder: 2, requiresAuth: false });
  await db.createMenuItem({ menuId: mainMenu.id, title: "Izin Penelitian", type: "route", value: "/izin-penelitian", sortOrder: 3, requiresAuth: false });
  await db.createMenuItem({ menuId: mainMenu.id, title: "Dokumen PPID", type: "route", value: "/dokumen", sortOrder: 4, requiresAuth: false });

  // Seed Letter Template
  await db.createTemplate({
    name: "Template Surat Izin Penelitian",
    content: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 0;">PEMERINTAH PROVINSI KALIMANTAN TENGAH</h2>
    <h3 style="margin: 0;">BADAN PERENCANAAN, PENELITIAN DAN PENGEMBANGAN DAERAH</h3>
    <p style="margin: 5px 0;">(BAPPERIDA)</p>
    <hr style="border: 2px solid #000;" />
  </div>
  <div style="text-align: center; margin: 20px 0;">
    <h3>SURAT IZIN PENELITIAN</h3>
    <p>Nomor: {{request_number}}</p>
  </div>
  <p>Yang bertanda tangan di bawah ini, Kepala Badan Perencanaan, Penelitian dan Pengembangan Daerah Provinsi Kalimantan Tengah, dengan ini memberikan izin penelitian kepada:</p>
  <table style="width: 100%; margin: 20px 0;">
    <tr><td style="width: 200px;">Nama</td><td>: {{full_name}}</td></tr>
    <tr><td>NIM/NIK</td><td>: {{nim_nik}}</td></tr>
    <tr><td>Asal Lembaga</td><td>: {{institution}}</td></tr>
    <tr><td>Judul Penelitian</td><td>: {{research_title}}</td></tr>
    <tr><td>Lokasi Penelitian</td><td>: {{research_location}}</td></tr>
    <tr><td>Durasi Penelitian</td><td>: {{research_duration}}</td></tr>
  </table>
  <p>Demikian surat izin penelitian ini diberikan untuk dapat digunakan sebagaimana mestinya.</p>
  <div style="margin-top: 40px; float: right; text-align: center;">
    <p>Palangka Raya, {{date}}</p>
    <p>Kepala BAPPERIDA Provinsi Kalimantan Tengah,</p>
    <br/><br/><br/>
    <p><strong>{{signer_name}}</strong></p>
  </div>
</div>`,
  });

  console.log("Database seeded successfully!");
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
      const result = await db.listNews({ page: +page, limit: +limit, categoryId, search, status, trash: trash === "true" });
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

  const newsUpload = getMulter("news", 5);
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

  // ─── Documents ───────────────────────────────────────────────────────────────
  app.get("/api/documents", async (req, res) => {
    try {
      const { page = "1", limit = "10", search } = req.query as any;
      return res.json(await db.listDocuments({ page: +page, limit: +limit, search }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/documents", authMiddleware, async (req, res) => {
    try {
      const { page = "1", limit = "10", search, trash } = req.query as any;
      return res.json(await db.listDocuments({ page: +page, limit: +limit, search, trash: trash === "true" }));
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  const docUpload = getMulter("documents", 10);
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
  const permitUpload = getMulter("permits", 1);

  // Public: Submit permit
  app.post("/api/permits", permitUpload.fields([
    { name: "fileIdentity" }, { name: "fileIntroLetter" },
    { name: "fileProposal" }, { name: "fileSocialMedia" }, { name: "fileSurvey" },
  ]), async (req: any, res) => {
    try {
      const data = { ...req.body };
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

  // ─── Letter Templates ─────────────────────────────────────────────────────────
  app.get("/api/admin/letter-templates", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { return res.json(await db.listTemplates()); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/letter-templates", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { return res.json(await db.createTemplate(req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/letter-templates/:id", authMiddleware, requireRole("super_admin", "admin_rida"), async (req, res) => {
    try { return res.json(await db.updateTemplate(req.params.id, req.body)); }
    catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

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

  // ─── Seed ─────────────────────────────────────────────────────────────────────
  await seedDatabase();

  return httpServer;
}
