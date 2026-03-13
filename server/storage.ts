import { eq, and, isNull, asc, desc, like, or, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, News, InsertNews, NewsCategory, InsertNewsCategory,
  NewsMedia, InsertNewsMedia, Banner, InsertBanner, Menu, InsertMenu,
  MenuItem, InsertMenuItem, Document, InsertDocument,
  ResearchPermit, InsertResearchPermit, Survey, InsertSurvey,
  FinalReport, InsertFinalReport, Suggestion, InsertSuggestion,
  DocumentRequest,
  InsertDocumentRequest,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── Helper: case-insensitive LIKE (MySQL-safe) ───────────────────────────────
function ciLike(column: any, term: string) {
  return like(sql`lower(${column})`, `%${term.toLowerCase()}%`);
}

// ─── Slug Generator ───────────────────────────────────────────────────────────
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${base}-${randomUUID().slice(0, 8)}`;
}

// ─── Generic helpers to replace `.returning()` on MySQL ───────────────────────
async function insertAndGet<T>(
  table: any,
  idColumn: any,
  values: any
): Promise<T> {
  const id = values.id ?? randomUUID();
  await db.insert(table).values({ ...values, id });
  const [row] = await db.select().from(table).where(eq(idColumn, id));
  if (!row) throw new Error("Insert failed (row not found after insert)");
  return row as T;
}

async function updateAndGet<T>(
  table: any,
  idColumn: any,
  id: string,
  values: any
): Promise<T> {
  await db.update(table).set(values).where(eq(idColumn, id));
  const [row] = await db.select().from(table).where(eq(idColumn, id));
  if (!row) throw new Error("Update failed (row not found after update)");
  return row as T;
}

// ─── Request Number Generator ─────────────────────────────────────────────────
async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const seq = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.requestSequences)
      .where(eq(schema.requestSequences.year, year))
      .for("update");

    if (existing) {
      const newSeq = (existing.lastSeq ?? 0) + 1;
      await tx
        .update(schema.requestSequences)
        .set({ lastSeq: newSeq })
        .where(eq(schema.requestSequences.id, existing.id));
      return newSeq;
    }

    await tx.insert(schema.requestSequences).values({ year, lastSeq: 1 });
    return 1;
  });

  return `BAPPERIDA-RID-${year}-${String(seq).padStart(6, "0")}`;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User>;

  // News Categories
  listNewsCategories(): Promise<NewsCategory[]>;
  createNewsCategory(data: InsertNewsCategory): Promise<NewsCategory>;
  updateNewsCategory(id: string, data: Partial<InsertNewsCategory>): Promise<NewsCategory>;
  deleteNewsCategory(id: string): Promise<void>;
  getNewsCategory(id: string): Promise<NewsCategory | undefined>;

  // News
  listNews(opts?: { page?: number; limit?: number; categoryId?: string; search?: string; status?: string; trash?: boolean }): Promise<{ items: News[]; total: number }>;
  getNews(id: string): Promise<News | undefined>;
  getNewsBySlug(slug: string): Promise<News | undefined>;
  createNews(data: InsertNews): Promise<News>;
  updateNews(id: string, data: Partial<InsertNews> & { viewCount?: number }): Promise<News>;
  deleteNews(id: string, hard?: boolean): Promise<void>;
  restoreNews(id: string): Promise<void>;
  toggleNewsStatus(id: string): Promise<News>;

  // News Media
  listNewsMedia(newsId: string): Promise<NewsMedia[]>;
  createNewsMedia(data: InsertNewsMedia): Promise<NewsMedia>;
  deleteNewsMedia(id: string): Promise<NewsMedia | undefined>;

  // Banners
  listBanners(opts?: { trash?: boolean }): Promise<Banner[]>;
  getBanner(id: string): Promise<Banner | undefined>;
  createBanner(data: InsertBanner): Promise<Banner>;
  updateBanner(id: string, data: Partial<InsertBanner>): Promise<Banner>;
  deleteBanner(id: string): Promise<void>;
  trackBannerView(id: string): Promise<void>;
  trackBannerClick(id: string): Promise<void>;
  getActiveBanners(): Promise<Banner[]>;

  // Menus
  listMenus(): Promise<Menu[]>;
  getMenu(id: string): Promise<Menu | undefined>;
  createMenu(data: InsertMenu): Promise<Menu>;
  updateMenu(id: string, data: Partial<InsertMenu>): Promise<Menu>;
  deleteMenu(id: string): Promise<void>;
  listMenuItems(menuId: string): Promise<MenuItem[]>;
  createMenuItem(data: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, data: Partial<InsertMenuItem>): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;

  // Document Masters
  listDocumentKinds(): Promise<any[]>;
  createDocumentKind(data: { name: string }): Promise<any>;
  updateDocumentKind(id: string, data: { name: string }): Promise<any>;
  deleteDocumentKind(id: string): Promise<void>;
  getDocumentById(id: string): Promise<Document | undefined>;
  incrementDocumentDownload(id: string): Promise<void>;
  listDocumentCategories(): Promise<any[]>;
  createDocumentCategory(data: { name: string; level: number }): Promise<any>;
  updateDocumentCategory(id: string, data: { name?: string; level?: number }): Promise<any>;
  deleteDocumentCategory(id: string): Promise<void>;
  getDocumentCategoryByLevel(level: number): Promise<any>;
  reorderDocumentCategories(updates: { id: string; level: number }[]): Promise<void>;
  listDocumentTypes(): Promise<any[]>;
  createDocumentType(data: { name: string; extension?: string }): Promise<any>;
  updateDocumentType(id: string, data: { name: string; extension?: string }): Promise<any>;
  deleteDocumentType(id: string): Promise<void>;

  // Documents
  listDocuments(opts?: { page?: number; limit?: number; search?: string; trash?: boolean; kindId?: string; categoryId?: string; typeId?: string }): Promise<{ items: Document[]; total: number }>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(data: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<void>;
  
  createDocumentRequest(data: schema.InsertDocumentRequest): Promise<DocumentRequest>;

  // Research Permits
  listPermits(opts?: { page?: number; limit?: number; status?: string; search?: string }): Promise<{ items: ResearchPermit[]; total: number }>;
  getPermit(id: string): Promise<ResearchPermit | undefined>;
  getPermitByEmail(email: string): Promise<ResearchPermit[]>;
  createPermit(data: InsertResearchPermit): Promise<ResearchPermit>;
  updatePermitStatus(id: string, status: string, note?: string, processedBy?: string): Promise<ResearchPermit>;
  updatePermit(id: string, data: Partial<ResearchPermit>): Promise<ResearchPermit>;
  addPermitStatusHistory(data: { permitId: string; fromStatus: string | null; toStatus: string; note?: string; changedBy?: string }): Promise<void>;
  getPermitHistory(permitId: string): Promise<any[]>;

  // Letter Templates
  listTemplates(): Promise<any[]>;
  getTemplate(id: string): Promise<any>;
  createTemplate(data: { name: string; content: string }): Promise<any>;
  updateTemplate(id: string, data: any): Promise<any>;
  deleteTemplate(id: string): Promise<void>;
  createLetterTemplateFile(data: {
    templateId: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }): Promise<any>;
  listLetterTemplateFiles(templateId: string): Promise<any[]>;

  // Generated Letters
  createGeneratedLetter(data: { permitId: string; templateId?: string; fileUrl?: string }): Promise<any>;
  getGeneratedLetter(permitId: string): Promise<any>;

  listLetterTemplateFiles(templateId: string): Promise<any[]>;
  getTemplateByType(type: string): Promise<any>;

  // Surveys
  createSurvey(data: InsertSurvey): Promise<Survey>;
  listSurveys(opts?: { page?: number; limit?: number }): Promise<{ items: Survey[]; total: number }>;

  // Final Reports
  createFinalReport(data: InsertFinalReport): Promise<FinalReport>;
  listFinalReports(opts?: { page?: number; limit?: number }): Promise<{ items: FinalReport[]; total: number }>;

  // Suggestions
  createSuggestion(data: InsertSuggestion): Promise<Suggestion>;
  listSuggestions(opts?: { page?: number; limit?: number }): Promise<{ items: Suggestion[]; total: number }>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;
  
   // Dashboard stats tambahan
   getNewsViewsStats(year?: number, month?: string): Promise<any>;
   getDocumentDownloadsStats(year?: number, month?: string): Promise<any>;
   getPermitOriginStats(year?: number): Promise<any[]>;
   getSurveySatisfactionStats(year?: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ───────────────────────────────────────────────────────────────────
  async getUser(id: string) {
    const [r] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return r;
  }
  async getUserByUsername(username: string) {
    const [r] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return r;
  }
  async getUserByEmail(email: string) {
    const [r] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return r;
  }
  async createUser(user: InsertUser) {
    return insertAndGet<User>(schema.users, schema.users.id, user);
  }
  async listUsers() {
    return db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }
  async updateUser(id: string, data: Partial<InsertUser>) {
    return updateAndGet<User>(schema.users, schema.users.id, id, { ...data, updatedAt: new Date() });
  }

  // ── News Categories ─────────────────────────────────────────────────────────
  async listNewsCategories() {
    return db
      .select()
      .from(schema.newsCategories)
      .where(isNull(schema.newsCategories.deletedAt))
      .orderBy(schema.newsCategories.name);
  }
  async createNewsCategory(data: InsertNewsCategory) {
    const slug = (data as any).slug || generateSlug((data as any).name);
    return insertAndGet<NewsCategory>(schema.newsCategories, schema.newsCategories.id, { ...data, slug });
  }
  async updateNewsCategory(id: string, data: Partial<InsertNewsCategory>) {
    return updateAndGet<NewsCategory>(schema.newsCategories, schema.newsCategories.id, id, data);
  }
  async deleteNewsCategory(id: string) {
    await db.update(schema.newsCategories).set({ deletedAt: new Date() }).where(eq(schema.newsCategories.id, id));
  }
  async getNewsCategory(id: string) {
    const [r] = await db.select().from(schema.newsCategories).where(eq(schema.newsCategories.id, id));
    return r;
  }

  // ── News ────────────────────────────────────────────────────────────────────
  async listNews(opts: { page?: number; limit?: number; categoryId?: string; search?: string; status?: string; trash?: boolean; sortBy?: string; sortDir?: string } = {}) {
    const { page = 1, limit = 10, categoryId, search, status, trash = false, sortBy = "publishedAt", sortDir = "desc" } = opts;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (trash) conditions.push(sql`${schema.news.deletedAt} IS NOT NULL`);
    else conditions.push(isNull(schema.news.deletedAt));
    if (categoryId) conditions.push(eq(schema.news.categoryId, categoryId));
    if (search) conditions.push(ciLike(schema.news.title, search));
    if (status) conditions.push(eq(schema.news.status, status as any));

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.news)
      .where(where);

    const items = await db
      .select()
      .from(schema.news)
      .where(where)
      .orderBy(sortDir === "asc" ? asc(schema.news[sortBy as keyof typeof schema.news] as any) : desc(schema.news[sortBy as keyof typeof schema.news] as any))
      .limit(limit)
      .offset(offset);

    return { items, total: Number(count) };
  }

  async getNews(id: string) {
    const [r] = await db.select().from(schema.news).where(eq(schema.news.id, id));
    return r;
  }

  async getNewsBySlug(slug: string) {
    const [r] = await db
      .select()
      .from(schema.news)
      .where(and(eq(schema.news.slug, slug), isNull(schema.news.deletedAt)));
    return r;
  }

  async getNewsById(id: string) {
    const [r] = await db
      .select()
      .from(schema.news)
      .where(and(eq(schema.news.id, id), isNull(schema.news.deletedAt)));
    return r;
  }

  async createNews(data: InsertNews) {
    const slug = (data as any).slug || generateSlug((data as any).title);
    return insertAndGet<News>(schema.news, schema.news.id, { ...data, slug });
  }

  async updateNews(id: string, data: Partial<InsertNews> & { viewCount?: number }) {
    return updateAndGet<News>(schema.news, schema.news.id, id, { ...data, updatedAt: new Date() });
  }

  async deleteNews(id: string, hard = false) {
    if (hard) {
      await db.delete(schema.news).where(eq(schema.news.id, id));
    } else {
      await db.update(schema.news).set({ deletedAt: new Date() }).where(eq(schema.news.id, id));
    }
  }

  async restoreNews(id: string) {
    await db.update(schema.news).set({ deletedAt: null }).where(eq(schema.news.id, id));
  }

  // ── News Media ──────────────────────────────────────────────────────────────
  async listNewsMedia(newsId: string) {
    return db
      .select()
      .from(schema.newsMedia)
      .where(and(eq(schema.newsMedia.newsId, newsId), isNull(schema.newsMedia.deletedAt)))
      .orderBy(schema.newsMedia.sortOrder);
  }

  async createNewsMedia(data: InsertNewsMedia) {
    return insertAndGet<NewsMedia>(schema.newsMedia, schema.newsMedia.id, data);
  }

  async deleteNewsMedia(id: string) {
    await db.update(schema.newsMedia).set({ deletedAt: new Date() }).where(eq(schema.newsMedia.id, id));
    const [r] = await db.select().from(schema.newsMedia).where(eq(schema.newsMedia.id, id));
    return r;
  }

  // ── Banners ─────────────────────────────────────────────────────────────────
  async listBanners(opts: { trash?: boolean } = {}) {
    if (opts.trash) {
      return db
        .select()
        .from(schema.banners)
        .where(sql`${schema.banners.deletedAt} IS NOT NULL`)
        .orderBy(desc(schema.banners.createdAt));
    }
    return db
      .select()
      .from(schema.banners)
      .where(isNull(schema.banners.deletedAt))
      .orderBy(desc(schema.banners.createdAt));
  }

  async getBanner(id: string) {
    const [r] = await db.select().from(schema.banners).where(eq(schema.banners.id, id));
    return r;
  }

  async createBanner(data: InsertBanner) {
    return insertAndGet<Banner>(schema.banners, schema.banners.id, data);
  }

  async updateBanner(id: string, data: Partial<InsertBanner>) {
    return updateAndGet<Banner>(schema.banners, schema.banners.id, id, { ...data, updatedAt: new Date() });
  }

  async deleteBanner(id: string) {
    await db.update(schema.banners).set({ deletedAt: new Date() }).where(eq(schema.banners.id, id));
  }

  async trackBannerView(id: string) {
    await db.update(schema.banners)
      .set({ viewCount: sql`${schema.banners.viewCount} + 1` })
      .where(eq(schema.banners.id, id));
  }

  async trackBannerClick(id: string) {
    await db.update(schema.banners)
      .set({ clickCount: sql`${schema.banners.clickCount} + 1` })
      .where(eq(schema.banners.id, id));
  }

  async getActiveBanners() {
    return db
      .select()
      .from(schema.banners)
      .where(and(isNull(schema.banners.deletedAt), eq(schema.banners.isActive, true)))
      .orderBy(desc(schema.banners.createdAt));
  }

  // ── Menus ───────────────────────────────────────────────────────────────────
  async listMenus() {
    return db.select().from(schema.menus).where(isNull(schema.menus.deletedAt)).orderBy(schema.menus.name);
  }

  async getMenu(id: string) {
    const [r] = await db.select().from(schema.menus).where(eq(schema.menus.id, id));
    return r;
  }

  async getMenuItem(id: string) {
    const [r] = await db
      .select()
      .from(schema.menuItems)
      .where(and(eq(schema.menuItems.id, id), isNull(schema.menuItems.deletedAt)));
    return r;
  }

  async createMenu(data: InsertMenu) {
    return insertAndGet<Menu>(schema.menus, schema.menus.id, data);
  }

  async updateMenu(id: string, data: Partial<InsertMenu>) {
    return updateAndGet<Menu>(schema.menus, schema.menus.id, id, data);
  }

  async deleteMenu(id: string) {
    await db.update(schema.menus).set({ deletedAt: new Date() }).where(eq(schema.menus.id, id));
  }

  async listMenuItems(menuId: string) {
    return db
      .select()
      .from(schema.menuItems)
      .where(and(eq(schema.menuItems.menuId, menuId), isNull(schema.menuItems.deletedAt)))
      .orderBy(schema.menuItems.sortOrder);
  }

  async createMenuItem(data: InsertMenuItem) {
    return insertAndGet<MenuItem>(schema.menuItems, schema.menuItems.id, data);
  }

  async updateMenuItem(id: string, data: Partial<InsertMenuItem>) {
    return updateAndGet<MenuItem>(schema.menuItems, schema.menuItems.id, id, data);
  }

  async deleteMenuItem(id: string) {
    await db.update(schema.menuItems).set({ deletedAt: new Date() }).where(eq(schema.menuItems.id, id));
  }

  // ── Document Masters ────────────────────────────────────────────────────────
  async listDocumentKinds() {
    return db.select().from(schema.documentKinds).where(isNull(schema.documentKinds.deletedAt)).orderBy(schema.documentKinds.name);
  }
  async createDocumentKind(data: { name: string }) {
    return insertAndGet<any>(schema.documentKinds, schema.documentKinds.id, { name: data.name });
  }
  async updateDocumentKind(id: string, data: { name: string }) {
    return updateAndGet<any>(schema.documentKinds, schema.documentKinds.id, id, { name: data.name });
  }
  async deleteDocumentKind(id: string) {
    await db.update(schema.documentKinds).set({ deletedAt: new Date() }).where(eq(schema.documentKinds.id, id));
  }

  async listDocumentCategories() {
    return db.select().from(schema.documentCategories).where(isNull(schema.documentCategories.deletedAt)).orderBy(schema.documentCategories.level);
  }
  async createDocumentCategory(data: { name: string; level: number }) {
    if (data.level < 1) {
      throw new Error("Level harus minimal 1");
    }
  
    const existing = await this.getDocumentCategoryByLevel(data.level);
  
    if (existing) {
      await updateAndGet<any>(
        schema.documentCategories,
        schema.documentCategories.id,
        existing.id,
        { level: null }
      );
    }
  
    return insertAndGet<any>(
      schema.documentCategories,
      schema.documentCategories.id,
      data
    );
  }
  
  async updateDocumentCategory(
    id: string,
    data: { name?: string; level?: number }
  ) {
    if (data.level !== undefined) {
      if (data.level < 1) {
        throw new Error("Level harus minimal 1");
      }
  
      const existing = await this.getDocumentCategoryByLevel(data.level);
  
      if (existing && existing.id !== id) {
        await updateAndGet<any>(
          schema.documentCategories,
          schema.documentCategories.id,
          existing.id,
          { level: null }
        );
      }
    }
  
    return updateAndGet<any>(
      schema.documentCategories,
      schema.documentCategories.id,
      id,
      data
    );
  }
  async deleteDocumentCategory(id: string) {
    await db.update(schema.documentCategories).set({ deletedAt: new Date() }).where(eq(schema.documentCategories.id, id));
  }
  async getDocumentCategoryByLevel(level: number) {
    const [item] = await db
      .select()
      .from(schema.documentCategories)
      .where(and(
        eq(schema.documentCategories.level, level),
        isNull(schema.documentCategories.deletedAt)
      ));
    return item;
  }
  async reorderDocumentCategories(updates: { id: string; level: number }[]) {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(schema.documentCategories)
          .set({ level: update.level })
          .where(eq(schema.documentCategories.id, update.id));
      }
    });
  }

  async listDocumentTypes() {
    return db.select().from(schema.documentTypes).where(isNull(schema.documentTypes.deletedAt)).orderBy(schema.documentTypes.name);
  }
  async createDocumentType(data: { name: string; extension?: string }) {
    return insertAndGet<any>(schema.documentTypes, schema.documentTypes.id, { name: data.name, extension: data.extension });
  }
  async updateDocumentType(id: string, data: { name: string; extension?: string }) {
    return updateAndGet<any>(schema.documentTypes, schema.documentTypes.id, id, { name: data.name, extension: data.extension });
  }
  async deleteDocumentType(id: string) {
    await db.update(schema.documentTypes).set({ deletedAt: new Date() }).where(eq(schema.documentTypes.id, id));
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  async listDocuments(opts: { page?: number; limit?: number; search?: string; trash?: boolean; kindId?: string; categoryId?: string; typeId?: string; sortBy?: string; sortDir?: string } = {}) {
    const { page = 1, limit = 10, search, trash = false, kindId, categoryId, typeId, sortBy = "publishedAt", sortDir = "desc" } = opts;
    const offset = (page - 1) * limit;

    const conditions: any[] = trash
      ? [sql`${schema.documents.deletedAt} IS NOT NULL`]
      : [isNull(schema.documents.deletedAt)];

    if (search) conditions.push(ciLike(schema.documents.title, search));
    if (kindId) conditions.push(eq(schema.documents.kindId, kindId));
    if (categoryId) conditions.push(eq(schema.documents.categoryId, categoryId));
    if (typeId) conditions.push(eq(schema.documents.typeId, typeId));

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.documents)
      .where(where);

    const items = await db
      .select()
      .from(schema.documents)
      .where(where)
      .orderBy(sortDir === "asc" ? asc(schema.documents[sortBy as keyof typeof schema.documents] as any) : desc(schema.documents[sortBy as keyof typeof schema.documents] as any))
      .limit(limit)
      .offset(offset);

    return { items, total: Number(count) };
  }

  async getDocument(id: string) {
    const [r] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return r;
  }

  async getDocumentById(id: string) {
    const [doc] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id));
    return doc;
  }
  
  async incrementDocumentDownload(id: string) {
    await db.update(schema.documents)
      .set({ 
        downloadedCount: sql`${schema.documents.downloadedCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(schema.documents.id, id));
  }

  async createDocumentRequest(data: InsertDocumentRequest) {
    return insertAndGet<DocumentRequest>(schema.documentRequests, schema.documentRequests.id, data);
  }

  async createDocument(data: InsertDocument) {
    return insertAndGet<Document>(schema.documents, schema.documents.id, data);
  }

  async updateDocument(id: string, data: Partial<InsertDocument>) {
    return updateAndGet<Document>(schema.documents, schema.documents.id, id, { ...data, updatedAt: new Date() });
  }

  async deleteDocument(id: string) {
    await db.update(schema.documents).set({ deletedAt: new Date() }).where(eq(schema.documents.id, id));
  }

  async restoreDocument(id: string) {
    await db.update(schema.documents).set({ deletedAt: null }).where(eq(schema.documents.id, id));
  }

  async toggleNewsStatus(id: string): Promise<News> {
    const [cur] = await db.select({ status: schema.news.status }).from(schema.news).where(eq(schema.news.id, id));
    if (!cur) throw new Error("Berita tidak ditemukan");

    const newStatus = cur.status === "published" ? "draft" : "published";
    const publishedAt = newStatus === "published" ? new Date() : null;

    await db.update(schema.news)
      .set({ status: newStatus as any, publishedAt, updatedAt: new Date() })
      .where(eq(schema.news.id, id));

    const [r] = await db.select().from(schema.news).where(eq(schema.news.id, id));
    if (!r) throw new Error("Update failed");
    return r;
  }

  // ── Research Permits ────────────────────────────────────────────────────────
  async listPermits(opts: { page?: number; limit?: number; status?: string; search?: string } = {}) {
    const { page = 1, limit = 10, status, search } = opts;
    const offset = (page - 1) * limit;

    const conditions: any[] = [isNull(schema.researchPermitRequests.deletedAt)];
    if (status) conditions.push(eq(schema.researchPermitRequests.status, status as any));

    if (search) {
      conditions.push(or(
        ciLike(schema.researchPermitRequests.fullName, search),
        ciLike(schema.researchPermitRequests.researchTitle, search),
        ciLike(schema.researchPermitRequests.requestNumber, search),
      )!);
    }

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.researchPermitRequests)
      .where(where);

    const items = await db
      .select()
      .from(schema.researchPermitRequests)
      .where(where)
      .orderBy(desc(schema.researchPermitRequests.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: Number(count) };
  }

  async getPermit(id: string) {
    const [r] = await db.select().from(schema.researchPermitRequests).where(eq(schema.researchPermitRequests.id, id));
    return r;
  }

  async getPermitByEmail(email: string) {
    return db.select().from(schema.researchPermitRequests)
      .where(and(eq(schema.researchPermitRequests.email, email), isNull(schema.researchPermitRequests.deletedAt)))
      .orderBy(desc(schema.researchPermitRequests.createdAt));
  }

  async getPermitByNumber(requestNumber: string) {
    const [r] = await db
      .select()
      .from(schema.researchPermitRequests)
      .where(
        and(
          eq(schema.researchPermitRequests.requestNumber, requestNumber),
          isNull(schema.researchPermitRequests.deletedAt)
        )
      );
  
    return r;
  }

  async createPermit(data: InsertResearchPermit) {
    const MAX_RETRY = 5;
  
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const requestNumber = await generateRequestNumber();
  
      try {
        const permit = await insertAndGet<ResearchPermit>(
          schema.researchPermitRequests,
          schema.researchPermitRequests.id,
          { ...data, requestNumber }
        );
  
        await this.addPermitStatusHistory({
          permitId: permit.id,
          fromStatus: null,
          toStatus: "submitted",
        });
  
        return permit;
  
      } catch (err: any) {
  
        if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
          if (attempt === MAX_RETRY - 1) {
            throw new Error("Failed to generate unique request number after retries");
          }
  
          continue; 
        }
  
        throw err;
      }
    }
  
    throw new Error("Unexpected error creating permit");
  }

  async updatePermitStatus(id: string, status: string, note?: string, processedBy?: string) {
    const current = await this.getPermit(id);

    await db.update(schema.researchPermitRequests)
      .set({ status: status as any, reviewNote: note, processedBy, updatedAt: new Date() })
      .where(eq(schema.researchPermitRequests.id, id));

    await this.addPermitStatusHistory({
      permitId: id,
      fromStatus: (current?.status as any) || null,
      toStatus: status,
      note,
      changedBy: processedBy,
    });

    const [r] = await db.select().from(schema.researchPermitRequests).where(eq(schema.researchPermitRequests.id, id));
    if (!r) throw new Error("Update failed");
    return r;
  }

  async updatePermit(id: string, data: Partial<ResearchPermit>) {
    return updateAndGet<ResearchPermit>(schema.researchPermitRequests, schema.researchPermitRequests.id, id, { ...data, updatedAt: new Date() });
  }

  async addPermitStatusHistory(data: { permitId: string; fromStatus: string | null; toStatus: string; note?: string; changedBy?: string }) {
    await db.insert(schema.permitStatusHistories).values({
      permitId: data.permitId,
      fromStatus: data.fromStatus as any,
      toStatus: data.toStatus as any,
      note: data.note,
      changedBy: data.changedBy,
    });
  }

  async getPermitHistory(permitId: string) {
    return db.select().from(schema.permitStatusHistories)
      .where(eq(schema.permitStatusHistories.permitId, permitId))
      .orderBy(desc(schema.permitStatusHistories.createdAt));
  }

  // ── Letter Templates ────────────────────────────────────────────────────────
  async listTemplates() {
    return db.select().from(schema.letterTemplates).orderBy(desc(schema.letterTemplates.createdAt));
  }

  async getTemplate(id: string) {
    const [r] = await db.select().from(schema.letterTemplates).where(eq(schema.letterTemplates.id, id));
    return r;
  }

  async createTemplate(data: { name: string; content: string }) {
    return insertAndGet<any>(schema.letterTemplates, schema.letterTemplates.id, data);
  }

  async updateTemplate(id: string, data: any) {
    return updateAndGet<any>(schema.letterTemplates, schema.letterTemplates.id, id, { ...data, updatedAt: new Date() });
  }

  async deleteTemplate(id: string) {
    await db
      .delete(schema.letterTemplateFiles)
      .where(eq(schema.letterTemplateFiles.templateId, id));
    await db
      .delete(schema.letterTemplates)
      .where(eq(schema.letterTemplates.id, id));
  }

  async createLetterTemplateFile(data: {
    templateId: string;
    fileUrl: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) {
    return insertAndGet<any>(
      schema.letterTemplateFiles,
      schema.letterTemplateFiles.id,
      {
        ...data,
        createdAt: new Date(),
      }
    );
  }  

  async getLetterTemplateFile(id: string) {
    const [file] = await db
      .select()
      .from(schema.letterTemplateFiles)
      .where(eq(schema.letterTemplateFiles.id, id));
    return file;
  }
  
  async listLetterTemplateFiles(templateId: string) {
    return db
      .select()
      .from(schema.letterTemplateFiles)
      .where(eq(schema.letterTemplateFiles.templateId, templateId));
  }

  // ── Generated Letters ───────────────────────────────────────────────────────
  async createGeneratedLetter(data: { permitId: string; templateId?: string; fileUrl?: string }) {
    return insertAndGet<any>(schema.generatedLetters, schema.generatedLetters.id, data);
  }

  async getGeneratedLetter(permitId: string) {
    const [r] = await db.select().from(schema.generatedLetters)
      .where(and(eq(schema.generatedLetters.permitId, permitId), isNull(schema.generatedLetters.deletedAt)))
      .orderBy(desc(schema.generatedLetters.createdAt));
    return r;
  }

  // ── Surveys ─────────────────────────────────────────────────────────────────
  async createSurvey(data: InsertSurvey) {
    return insertAndGet<Survey>(schema.surveys, schema.surveys.id, data);
  }

  async listSurveys(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.surveys);
    const items = await db.select().from(schema.surveys).orderBy(desc(schema.surveys.createdAt)).limit(limit).offset(offset);

    return { items, total: Number(count) };
  }

  // ── Final Reports ───────────────────────────────────────────────────────────
  async createFinalReport(data: InsertFinalReport) {
    return insertAndGet<FinalReport>(schema.finalReports, schema.finalReports.id, data);
  }

  async listFinalReports(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.finalReports);
    const items = await db.select().from(schema.finalReports).orderBy(desc(schema.finalReports.createdAt)).limit(limit).offset(offset);

    return { items, total: Number(count) };
  }

  // ── Suggestions ─────────────────────────────────────────────────────────────
  async createSuggestion(data: InsertSuggestion) {
    return insertAndGet<Suggestion>(schema.suggestionBox, schema.suggestionBox.id, data);
  }

  async listSuggestions(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.suggestionBox);
    const items = await db.select().from(schema.suggestionBox).orderBy(desc(schema.suggestionBox.createdAt)).limit(limit).offset(offset);

    return { items, total: Number(count) };
  }

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
    const [newsCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.news).where(isNull(schema.news.deletedAt));
    const [newsTrash] = await db.select({ count: sql<number>`count(*)` }).from(schema.news).where(sql`${schema.news.deletedAt} IS NOT NULL`);
    const [publishedNews] = await db.select({ count: sql<number>`count(*)` }).from(schema.news).where(and(isNull(schema.news.deletedAt), eq(schema.news.status, "published")));
    const [permitCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.researchPermitRequests).where(isNull(schema.researchPermitRequests.deletedAt));
    const [pendingPermits] = await db.select({ count: sql<number>`count(*)` }).from(schema.researchPermitRequests).where(and(isNull(schema.researchPermitRequests.deletedAt), eq(schema.researchPermitRequests.status, "submitted")));
    const [surveyCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.surveys);
    const [bannerCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.banners).where(isNull(schema.banners.deletedAt));
    const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.documents).where(isNull(schema.documents.deletedAt));

    return {
      news: Number(newsCount.count),
      publishedNews: Number(publishedNews.count),
      newsTrash: Number(newsTrash.count),
      permits: Number(permitCount.count),
      pendingPermits: Number(pendingPermits.count),
      surveys: Number(surveyCount.count),
      banners: Number(bannerCount.count),
      documents: Number(docCount.count),
    };
  }

  async getNewsViewsStats(year?: number) {
    const targetYear = year || new Date().getFullYear();
    
    // Ambil data per bulan
    const monthlyStats = await Promise.all(
      MONTHS_ID.map(async (monthName, index) => {
        const monthNumber = index + 1;
        const startDate = new Date(targetYear, monthNumber - 1, 1);
        const endDate = new Date(targetYear, monthNumber, 0);
        
        // Total views bulan ini
        const [totalViews] = await db
          .select({ total: sql<number>`coalesce(sum(${schema.news.viewCount}), 0)` })
          .from(schema.news)
          .where(
            and(
              isNull(schema.news.deletedAt),
              eq(schema.news.status, "published"),
              sql`${schema.news.publishedAt} BETWEEN ${startDate} AND ${endDate}`
            )
          );

        // Top 5 news bulan ini
        const topNews = await db
          .select({
            id: schema.news.id,
            title: schema.news.title,
            views: schema.news.viewCount,
            slug: schema.news.slug,
            month: sql<string>`${monthName}`,
            year: sql<number>`${targetYear}`,
          })
          .from(schema.news)
          .where(
            and(
              isNull(schema.news.deletedAt),
              eq(schema.news.status, "published"),
              sql`${schema.news.publishedAt} BETWEEN ${startDate} AND ${endDate}`
            )
          )
          .orderBy(desc(schema.news.viewCount))
          .limit(5);

        return {
          month: monthName,
          month_number: monthNumber,
          year: targetYear,
          total_views: Number(totalViews?.total || 0),
          top_news: topNews,
          // Untuk chart, ambil judul dan views dari top 1
          top_news_title: topNews[0]?.title || null,
          top_news_views: topNews[0]?.views || 0,
        };
      })
    );

    return monthlyStats;
  }

  // Untuk document downloads
  async getDocumentDownloadsStats(year?: number) {
    const targetYear = year || new Date().getFullYear();
    
    const monthlyStats = await Promise.all(
      MONTHS_ID.map(async (monthName, index) => {
        const monthNumber = index + 1;
        const startDate = new Date(targetYear, monthNumber - 1, 1);
        const endDate = new Date(targetYear, monthNumber, 0);
        
        const [totalDownloads] = await db
          .select({ total: sql<number>`coalesce(sum(${schema.documents.downloadedCount}), 0)` })
          .from(schema.documents)
          .where(
            and(
              isNull(schema.documents.deletedAt),
              eq(schema.documents.status, "published"),
              sql`${schema.documents.publishedAt} BETWEEN ${startDate} AND ${endDate}`
            )
          );

        const topDocuments = await db
          .select({
            id: schema.documents.id,
            title: schema.documents.title,
            downloads: schema.documents.downloadedCount,
            fileUrl: schema.documents.fileUrl,
          })
          .from(schema.documents)
          .where(
            and(
              isNull(schema.documents.deletedAt),
              eq(schema.documents.status, "published"),
              sql`${schema.documents.publishedAt} BETWEEN ${startDate} AND ${endDate}`
            )
          )
          .orderBy(desc(schema.documents.downloadedCount))
          .limit(5);

        return {
          month: monthName,
          month_number: monthNumber,
          year: targetYear,
          total_downloads: Number(totalDownloads?.total || 0),
          top_documents: topDocuments,
          top_doc_title: topDocuments[0]?.title || null,
          top_doc_downloads: topDocuments[0]?.downloads || 0,
        };
      })
    );

    return monthlyStats;
  }
  
  async getPermitOriginStats(year?: number) {
    const targetYear = year || new Date().getFullYear();
    
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31);
  
    const institutions = await db
      .select({
        institution: schema.researchPermitRequests.institution,
        count: sql<number>`count(*)`,
      })
      .from(schema.researchPermitRequests)
      .where(
        and(
          isNull(schema.researchPermitRequests.deletedAt),
          sql`${schema.researchPermitRequests.createdAt} BETWEEN ${startDate} AND ${endDate}`
        )
      )
      .groupBy(schema.researchPermitRequests.institution)
      .orderBy(desc(sql`count(*)`));
  
    const total = institutions.reduce((sum, item) => sum + Number(item.count), 0);
  
    return institutions.map(item => ({
      institution: item.institution || "Tidak diketahui",
      count: Number(item.count),
      percentage: total > 0 ? Math.round((Number(item.count) / total) * 100) : 0,
    }));
  }
  
  // async getSurveySatisfactionStats(year?: number) {
  //   const targetYear = year || new Date().getFullYear();
    
  //   const startDate = new Date(targetYear, 0, 1);
  //   const endDate = new Date(targetYear, 11, 31);
  
  //   const surveys = await db
  //     .select()
  //     .from(schema.surveys)
  //     .where(sql`${schema.surveys.createdAt} BETWEEN ${startDate} AND ${endDate}`);
  
  //   const totalResponses = surveys.length;
  
  //   // Hitung rata-rata kepuasan (asumsi ada field rating 1-5)
  //   let totalRating = 0;
  //   surveys.forEach(s => {
  //     if (s.rating) totalRating += s.rating;
  //   });
  //   const avgRating = totalResponses > 0 ? (totalRating / totalResponses) * 20 : 0; // Konversi ke persen
  
  //   // Kategori kepuasan (contoh, sesuaikan dengan struktur survey Anda)
  //   const categories = [
  //     { category: "Pelayanan", value: avgRating, percentage: Math.round(avgRating) },
  //     { category: "Kecepatan", value: avgRating - 5, percentage: Math.round(avgRating - 5) },
  //     { category: "Kejelasan", value: avgRating + 2, percentage: Math.round(avgRating + 2) },
  //     { category: "Fasilitas", value: avgRating - 8, percentage: Math.round(avgRating - 8) },
  //     { category: "Sikap Petugas", value: avgRating + 5, percentage: Math.round(avgRating + 5) },
  //   ].map(c => ({
  //     ...c,
  //     value: Math.min(100, Math.max(0, c.value)),
  //     percentage: Math.min(100, Math.max(0, c.percentage)),
  //   }));
  
  //   // Trend bulanan
  //   const monthlyTrend = await Promise.all(
  //     MONTHS_ID.map(async (month, idx) => {
  //       const monthStart = new Date(targetYear, idx, 1);
  //       const monthEnd = new Date(targetYear, idx + 1, 0);
        
  //       const monthSurveys = await db
  //         .select()
  //         .from(schema.surveys)
  //         .where(sql`${schema.surveys.createdAt} BETWEEN ${monthStart} AND ${monthEnd}`);
  
  //       let monthRating = 0;
  //       monthSurveys.forEach(s => {
  //         if (s.rating) monthRating += s.rating;
  //       });
  //       const monthAvg = monthSurveys.length > 0 ? (monthRating / monthSurveys.length) * 20 : 0;
  
  //       return {
  //         month: month.substring(0, 3),
  //         responses: monthSurveys.length,
  //         satisfaction: Math.round(monthAvg),
  //       };
  //     })
  //   );
  
  //   return {
  //     total_responses: totalResponses,
  //     satisfaction_rate: Math.round(avgRating),
  //     categories,
  //     monthly_trend: monthlyTrend,
  //   };
  // }
}

export const storage = new DatabaseStorage();