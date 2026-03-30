// server/seed/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "./db";
import * as schema from "@shared/schema";

// ---------- helpers ----------
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function ensureUser(opts: {
  username: string;
  email: string;
  fullName: string;
  role: "super_admin" | "admin_bpp" | "admin_rida" | "user";
  passwordPlain: string;
}) {
  const [exist] = await db.select().from(schema.users).where(eq(schema.users.username, opts.username));
  if (exist) return exist;

  const hashed = await bcrypt.hash(opts.passwordPlain, 10);
  const id = randomUUID();

  await db.insert(schema.users).values({
    id,
    username: opts.username,
    email: opts.email,
    password: hashed,
    fullName: opts.fullName,
    role: opts.role as any,
    isActive: true,
  });

  const [created] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return created!;
}

async function ensureNewsCategory(name: string, slug?: string) {
  const s = slug ?? slugify(name);
  const [exist] = await db.select().from(schema.newsCategories).where(eq(schema.newsCategories.slug, s));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.newsCategories).values({
    id,
    name,
    slug: s,
    description: `${name} category`,
  } as any);

  const [created] = await db.select().from(schema.newsCategories).where(eq(schema.newsCategories.id, id));
  return created!;
}

async function ensureNews(opts: {
  title: string;
  categoryId?: string | null;
  authorId?: string | null;
  status?: "draft" | "published";
  contentHtml?: string;
  excerpt?: string;
  eventAt?: Date | null;
  featuredImage?: string | null;
}) {
  const slug = `${slugify(opts.title)}-${randomUUID().slice(0, 8)}`; // collision-safe
  // idempotent by "title + author + created_at" is hard. We use a stable slug seed key:
  // We'll use a deterministic slug key from title only (for seed) so repeated run won't create duplicates.
  const stableSlug = `${slugify(opts.title)}`;

  const [exist] = await db.select().from(schema.news).where(eq(schema.news.slug, stableSlug));
  if (exist) return exist;

  const id = randomUUID();
  const status = opts.status ?? "published";
  const publishedAt = status === "published" ? new Date() : null;

  await db.insert(schema.news).values({
    id,
    title: opts.title,
    slug: stableSlug,
    categoryId: opts.categoryId ?? null,
    content: opts.contentHtml ?? `<p>${opts.title} — konten contoh.</p><p>Lorem ipsum...</p>`,
    excerpt: opts.excerpt ?? `Ringkasan: ${opts.title}`,
    url: null,
    featuredImage: opts.featuredImage ?? null,
    featuredCaption: "Foto dokumentasi",
    status: status as any,
    eventAt: opts.eventAt ?? null,
    publishedAt,
    authorId: opts.authorId ?? null,
    viewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.news).where(eq(schema.news.id, id));
  return created!;
}

async function ensureNewsMedia(opts: {
  newsId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  caption?: string;
  isMain?: boolean;
  sortOrder?: number;
}) {
  const [exist] = await db
    .select()
    .from(schema.newsMedia)
    .where(
      and(
        eq(schema.newsMedia.newsId, opts.newsId),
        eq(schema.newsMedia.fileUrl, opts.fileUrl),
        isNull(schema.newsMedia.deletedAt)
      )
    );

  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.newsMedia).values({
    id,
    newsId: opts.newsId,
    fileUrl: opts.fileUrl,
    fileName: opts.fileName,
    fileSize: 123456,
    mimeType: opts.mimeType,
    caption: opts.caption ?? null,
    isMain: opts.isMain ?? false,
    type: "image",
    insertAfterParagraph: 0,
    sortOrder: opts.sortOrder ?? 0,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.newsMedia).where(eq(schema.newsMedia.id, id));
  return created!;
}

async function ensureBanner(opts: {
  title: string;
  slug: string;
  placement?: string;
  linkType?: "external" | "page" | "news";
  linkUrl?: string | null;
}) {
  const [exist] = await db.select().from(schema.banners).where(eq(schema.banners.slug as any, opts.slug as any)).catch(() => []);
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.banners).values({
    id,
    title: opts.title,
    slug: opts.slug as any,
    placement: (opts.placement ?? "home") as any,
    imageDesktop: "/seed/banner-desktop.jpg",
    imageMobile: "/seed/banner-mobile.jpg",
    altText: opts.title,
    linkType: (opts.linkType ?? "external") as any,
    linkUrl: opts.linkUrl ?? "https://example.com",
    target: "_self",
    sortOrder: 0,
    startAt: null,
    endAt: null,
    isActive: true,
    viewCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.banners).where(eq(schema.banners.id, id));
  return created!;
}

async function ensureMenu(name: string, location: "header" | "footer" | "mobile") {
  const [exist] = await db.select().from(schema.menus).where(eq(schema.menus.name, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.menus).values({
    id,
    name,
    location: location as any,
    isActive: true,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.menus).where(eq(schema.menus.id, id));
  return created!;
}

async function ensureMenuItem(opts: {
  menuId: string;
  title: string;
  type: "route" | "url" | "page" | "news";
  value: string;
  sortOrder: number;
}) {
  const [exist] = await db
    .select()
    .from(schema.menuItems)
    .where(and(eq(schema.menuItems.menuId, opts.menuId), eq(schema.menuItems.title, opts.title), isNull(schema.menuItems.deletedAt)));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.menuItems).values({
    id,
    menuId: opts.menuId,
    parentId: null,
    title: opts.title,
    type: opts.type as any,
    value: opts.value,
    icon: null,
    target: "_self",
    requiresAuth: false,
    sortOrder: opts.sortOrder,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id));
  return created!;
}

async function ensureDocKind(name: string) {
  const [exist] = await db.select().from(schema.documentKinds).where(eq(schema.documentKinds.name, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.documentKinds).values({ id, name, createdAt: new Date() } as any);
  const [created] = await db.select().from(schema.documentKinds).where(eq(schema.documentKinds.id, id));
  return created!;
}

async function ensureDocCategory(name: string) {
  const [exist] = await db.select().from(schema.documentCategories).where(eq(schema.documentCategories.name, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.documentCategories).values({ id, name, createdAt: new Date() } as any);
  const [created] = await db.select().from(schema.documentCategories).where(eq(schema.documentCategories.id, id));
  return created!;
}

async function ensureDocType(name: string, extension?: string) {
  const [exist] = await db.select().from(schema.documentTypes).where(eq(schema.documentTypes.name, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.documentTypes).values({ id, name, extension: extension ?? "pdf", createdAt: new Date() } as any);
  const [created] = await db.select().from(schema.documentTypes).where(eq(schema.documentTypes.id, id));
  return created!;
}

async function ensureDocument(opts: {
  title: string;
  kindId?: string | null;
  categoryId?: string | null;
  typeId?: string | null;
  accessLevel?: "terbuka" | "terbatas" | "rahasia";
  status?: "draft" | "published";
}) {
  // idempotent by title
  const [exist] = await db.select().from(schema.documents).where(eq(schema.documents.title, opts.title));
  if (exist) return exist;

  const id = randomUUID();
  const status = opts.status ?? "published";
  const publishedAt = status === "published" ? new Date() : null;

  await db.insert(schema.documents).values({
    id,
    title: opts.title,
    docNo: `DOC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999)}`,
    kindId: opts.kindId ?? null,
    categoryId: opts.categoryId ?? null,
    typeId: opts.typeId ?? null,
    publisher: "BAPPERIDA Kalteng",
    content: `Konten dokumen: ${opts.title}`,
    fileUrl: "/seed/doc.pdf",
    filePath: "storage/seed/doc.pdf",
    accessLevel: (opts.accessLevel ?? "terbuka") as any,
    publishedAt,
    status: status as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
  return created!;
}

async function ensureRequestSeqYear(year: number) {
  const [exist] = await db.select().from(schema.requestSequences).where(eq(schema.requestSequences.year, year));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.requestSequences).values({ id, year, lastSeq: 0 } as any);
  const [created] = await db.select().from(schema.requestSequences).where(eq(schema.requestSequences.id, id));
  return created!;
}

async function ensurePermit(opts: {
  requestNumber: string;
  email: string;
  fullName: string;
  nimNik: string;
  phoneWa: string;
  institution: string;
  researchTitle: string;
  status?: typeof schema.permitStatusEnum.enumValues[number];
  processedBy?: string | null;
}) {
  const [exist] = await db
    .select()
    .from(schema.researchPermitRequests)
    .where(eq(schema.researchPermitRequests.requestNumber, opts.requestNumber));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.researchPermitRequests).values({
    id,
    requestNumber: opts.requestNumber,
    email: opts.email,
    fullName: opts.fullName,
    nimNik: opts.nimNik,
    birthPlace: "Palangka Raya",
    workUnit: "Unit Contoh",
    institution: opts.institution,
    phoneWa: opts.phoneWa,
    citizenship: "WNI" as any,
    researchLocation: "Kalimantan Tengah",
    researchDuration: "2 Bulan",
    researchTitle: opts.researchTitle,
    signerPosition: "Kepala BAPPERIDA",
    introLetterNumber: "123/ABC/2026",
    introLetterDate: new Date(),
    fileIdentity: "/seed/ktp.pdf",
    fileIntroLetter: "/seed/surat_pengantar.pdf",
    fileProposal: "/seed/proposal.pdf",
    fileSocialMedia: null,
    fileSurvey: null,
    agreementFinalReport: true,
    status: (opts.status ?? "submitted") as any,
    reviewNote: null,
    processedBy: opts.processedBy ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.researchPermitRequests).where(eq(schema.researchPermitRequests.id, id));
  return created!;
}

async function ensurePermitHistory(opts: {
  permitId: string;
  fromStatus: any;
  toStatus: any;
  note?: string | null;
  changedBy?: string | null;
}) {
  // idempotent-ish: avoid duplicate by same toStatus+permitId
  const [exist] = await db
    .select()
    .from(schema.permitStatusHistories)
    .where(and(eq(schema.permitStatusHistories.permitId, opts.permitId), eq(schema.permitStatusHistories.toStatus as any, opts.toStatus as any)));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.permitStatusHistories).values({
    id,
    permitId: opts.permitId,
    fromStatus: opts.fromStatus,
    toStatus: opts.toStatus,
    note: opts.note ?? null,
    changedBy: opts.changedBy ?? null,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.permitStatusHistories).where(eq(schema.permitStatusHistories.id, id));
  return created!;
}

async function ensureTemplate(name: string) {
  const [exist] = await db.select().from(schema.letterTemplates).where(eq(schema.letterTemplates.name, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.letterTemplates).values({
    id,
    name,
    type: "research_permit",
    content:
      "SURAT IZIN PENELITIAN\n\nNomor: {{requestNumber}}\nNama: {{fullName}}\nJudul: {{researchTitle}}\n\n(TTD)",
    placeholders: JSON.stringify(["requestNumber", "fullName", "researchTitle"]),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.letterTemplates).where(eq(schema.letterTemplates.id, id));
  return created!;
}

async function ensureGeneratedLetter(opts: { permitId: string; templateId: string }) {
  const [exist] = await db
    .select()
    .from(schema.generatedLetters)
    .where(and(eq(schema.generatedLetters.permitId, opts.permitId), isNull(schema.generatedLetters.deletedAt)));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.generatedLetters).values({
    id,
    permitId: opts.permitId,
    templateId: opts.templateId,
    fileUrl: "/seed/surat_izin_penelitian.pdf",
    letterNumber: "BAPPERIDA/2026/0001",
    letterDate: new Date(),
    dataSnapshot: JSON.stringify({}),
    generatedBy: null,
    generatedAt: new Date(),
    sentAt: null,
    sentToEmail: null,
    sendError: null,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.generatedLetters).where(eq(schema.generatedLetters.id, id));
  return created!;
}

async function ensureSurvey(idx: number) {
  const name = `Responden ${idx}`;
  const [exist] = await db.select().from(schema.surveys).where(eq(schema.surveys.respondentName, name));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.surveys).values({
    id,
    respondentName: name,
    age: 20 + idx,
    gender: (idx % 2 === 0 ? "laki-laki" : "perempuan") as any,
    education: "S1",
    occupation: "Mahasiswa",
    q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, q6: 4, q7: 4, q8: 4, q9: 4,
    suggestion: "Pelayanan sudah baik.",
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.surveys).where(eq(schema.surveys.id, id));
  return created!;
}

async function ensureFinalReport(idx: number, permitRequestId?: string | null) {
  const email = `finalreport${idx}@example.com`;
  const [exist] = await db.select().from(schema.finalReports).where(eq(schema.finalReports.email, email));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.finalReports).values({
    id,
    name: `Pelapor ${idx}`,
    email,
    researchTitle: `Laporan Akhir ${idx}`,
    permitRequestId: permitRequestId ?? null,
    fileUrl: "/seed/final_report.pdf",
    suggestion: "Terima kasih.",
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.finalReports).where(eq(schema.finalReports.id, id));
  return created!;
}

async function ensureSuggestion(idx: number) {
  const email = `saran${idx}@example.com`;
  const message = `Saran ke-${idx}: tingkatkan informasi publik.`;
  const [exist] = await db.select().from(schema.suggestionBox).where(and(eq(schema.suggestionBox.email, email), eq(schema.suggestionBox.message, message)));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.suggestionBox).values({
    id,
    name: `Pengguna ${idx}`,
    email,
    message,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.suggestionBox).where(eq(schema.suggestionBox.id, id));
  return created!;
}

async function ensureAudit(userId: string | null, action: string, entity: string, entityId?: string | null) {
  // keep small; idempotent not needed strongly, but avoid duplicates
  const meta = JSON.stringify({ seed: true });
  const [exist] = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, action), eq(schema.auditLogs.entity, entity), eq(schema.auditLogs.entityId as any, entityId ?? null as any)));
  if (exist) return exist;

  const id = randomUUID();
  await db.insert(schema.auditLogs).values({
    id,
    userId,
    action,
    entity,
    entityId: entityId ?? null,
    meta,
    createdAt: new Date(),
  } as any);

  const [created] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.id, id));
  return created!;
}

// ---------- main seed ----------
async function main() {
  if (process.env.RUN_SEED !== "true") {
    console.log("Seed disabled (RUN_SEED != true).");
    process.exit(0);
  }

  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin@123";

  console.log("🌱 Seeding users...");
  const superadmin = await ensureUser({
    username: "superadmin",
    email: "superadmin@bapperida.local",
    fullName: "Super Admin",
    role: "super_admin",
    passwordPlain: adminPass,
  });

  const adminBpp = await ensureUser({
    username: "admin_bpp",
    email: "admin.bpp@bapperida.local",
    fullName: "Admin BPP",
    role: "admin_bpp",
    passwordPlain: adminPass,
  });

  const adminRida = await ensureUser({
    username: "admin_rida",
    email: "admin.rida@bapperida.local",
    fullName: "Admin RIDA",
    role: "admin_rida",
    passwordPlain: adminPass,
  });

  // beberapa user aplikasi
  const appUsers = [];
  for (let i = 1; i <= 5; i++) {
    appUsers.push(
      await ensureUser({
        username: `user${i}`,
        email: `user${i}@example.com`,
        fullName: `User Aplikasi ${i}`,
        role: "user",
        passwordPlain: "User@123",
      })
    );
  }

  console.log("🌱 Seeding news categories...");
  const cat1 = await ensureNewsCategory("Riset dan Inovasi Daerah", "riset-inovasi-daerah");
  const cat2 = await ensureNewsCategory("Perencanaan Pembangunan", "perencanaan-pembangunan");
  const cat3 = await ensureNewsCategory("Pengumuman", "pengumuman");

  console.log("🌱 Seeding news (5 items)...");
  const news1 = await ensureNews({ title: "BAPPERIDA Gelar Forum Inovasi 2026", categoryId: cat1.id, authorId: adminRida.id, status: "published" });
  const news2 = await ensureNews({ title: "Rapat Koordinasi Perencanaan Daerah", categoryId: cat2.id, authorId: adminBpp.id, status: "published" });
  const news3 = await ensureNews({ title: "Pengumuman Jadwal Layanan Publik", categoryId: cat3.id, authorId: adminBpp.id, status: "published" });
  const news4 = await ensureNews({ title: "Kickoff Program Data & AI Pemerintah Daerah", categoryId: cat1.id, authorId: superadmin.id, status: "draft" });
  const news5 = await ensureNews({ title: "Publikasi Dokumen PPID Triwulan I", categoryId: cat3.id, authorId: adminRida.id, status: "published" });

  console.log("🌱 Seeding news media...");
  await ensureNewsMedia({ newsId: news1.id, fileUrl: "/seed/news1.jpg", fileName: "news1.jpg", mimeType: "image/jpeg", caption: "Dokumentasi kegiatan", isMain: true, sortOrder: 0 });
  await ensureNewsMedia({ newsId: news2.id, fileUrl: "/seed/news2.jpg", fileName: "news2.jpg", mimeType: "image/jpeg", caption: "Rapat koordinasi", isMain: true, sortOrder: 0 });
  await ensureNewsMedia({ newsId: news3.id, fileUrl: "/seed/news3.jpg", fileName: "news3.jpg", mimeType: "image/jpeg", caption: "Pengumuman", isMain: true, sortOrder: 0 });

  console.log("🌱 Seeding banners...");
  await ensureBanner({ title: "Banner Utama", slug: "banner-utama", placement: "home", linkType: "external", linkUrl: "https://kalteng.go.id" });
  await ensureBanner({ title: "Banner PPID", slug: "banner-ppid", placement: "home", linkType: "page", linkUrl: "/ppid" });

  console.log("🌱 Seeding menus & items...");
  const headerMenu = await ensureMenu("Main Menu", "header");
  await ensureMenuItem({ menuId: headerMenu.id, title: "Beranda", type: "route", value: "/", sortOrder: 1 });
  await ensureMenuItem({ menuId: headerMenu.id, title: "Berita", type: "route", value: "/news", sortOrder: 2 });
  await ensureMenuItem({ menuId: headerMenu.id, title: "PPID", type: "route", value: "/ppid", sortOrder: 3 });
  await ensureMenuItem({ menuId: headerMenu.id, title: "Izin Penelitian", type: "route", value: "/izin-penelitian", sortOrder: 4 });

  console.log("🌱 Seeding document masters...");
  const kind1 = await ensureDocKind("Informasi Berkala");
  const kind2 = await ensureDocKind("Informasi Serta Merta");
  const dcat1 = await ensureDocCategory("Perencanaan");
  const dcat2 = await ensureDocCategory("Keuangan");
  const dtype1 = await ensureDocType("PDF", "pdf");
  const dtype2 = await ensureDocType("DOCX", "docx");

  console.log("🌱 Seeding documents (5 items)...");
  const doc1 = await ensureDocument({ title: "Dokumen RKPD 2026", kindId: kind1.id, categoryId: dcat1.id, typeId: dtype1.id, accessLevel: "terbuka", status: "published" });
  const doc2 = await ensureDocument({ title: "Laporan Keuangan Triwulan I", kindId: kind1.id, categoryId: dcat2.id, typeId: dtype1.id, accessLevel: "terbatas", status: "published" });
  const doc3 = await ensureDocument({ title: "SOP Layanan Informasi Publik", kindId: kind2.id, categoryId: dcat1.id, typeId: dtype2.id, accessLevel: "terbuka", status: "published" });
  const doc4 = await ensureDocument({ title: "Daftar Informasi Publik", kindId: kind1.id, categoryId: dcat1.id, typeId: dtype1.id, accessLevel: "terbuka", status: "draft" });
  const doc5 = await ensureDocument({ title: "Ringkasan Program Prioritas", kindId: kind2.id, categoryId: dcat1.id, typeId: dtype1.id, accessLevel: "terbuka", status: "published" });

  console.log("🌱 Seeding request sequences & permits...");
  const year = new Date().getFullYear();
  await ensureRequestSeqYear(year);

  const permit1 = await ensurePermit({
    requestNumber: `BAPPERIDA-RID-${year}-000001`,
    email: "pemohon1@example.com",
    fullName: "Pemohon Satu",
    nimNik: "1234567890",
    phoneWa: "081234567890",
    institution: "Universitas Contoh",
    researchTitle: "Kajian Inovasi Pelayanan Publik",
    status: "submitted",
    processedBy: adminRida.id,
  });

  const permit2 = await ensurePermit({
    requestNumber: `BAPPERIDA-RID-${year}-000002`,
    email: "pemohon2@example.com",
    fullName: "Pemohon Dua",
    nimNik: "9876543210",
    phoneWa: "081298765432",
    institution: "Institut Contoh",
    researchTitle: "Analisis Data Pembangunan Daerah",
    status: "approved",
    processedBy: adminBpp.id,
  });

  await ensurePermitHistory({ permitId: permit1.id, fromStatus: null, toStatus: "submitted", note: "Permohonan diterima", changedBy: adminRida.id });
  await ensurePermitHistory({ permitId: permit2.id, fromStatus: "submitted", toStatus: "approved", note: "Disetujui", changedBy: adminBpp.id });

  console.log("🌱 Seeding letter templates & generated letters...");
  const tpl = await ensureTemplate("Template Izin Penelitian Default");
  await ensureGeneratedLetter({ permitId: permit2.id, templateId: tpl.id });

  console.log("🌱 Seeding surveys (5)...");
  for (let i = 1; i <= 5; i++) await ensureSurvey(i);

  console.log("🌱 Seeding final reports (5)...");
  for (let i = 1; i <= 5; i++) await ensureFinalReport(i, i % 2 === 0 ? permit2.id : null);

  console.log("🌱 Seeding suggestion box (5)...");
  for (let i = 1; i <= 5; i++) await ensureSuggestion(i);

  console.log("🌱 Seeding audit logs...");
  await ensureAudit(superadmin.id, "seed", "users", superadmin.id);
  await ensureAudit(adminBpp.id, "seed", "news", news2.id);
  await ensureAudit(adminRida.id, "seed", "documents", doc1.id);
  await ensureAudit(null, "seed", "permits", permit1.id);

  console.log("✅ Seed done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});