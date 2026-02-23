import { eq, and, isNull, desc, ilike, or, sql, lte } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, News, InsertNews, NewsCategory, InsertNewsCategory,
  NewsMedia, InsertNewsMedia, Banner, InsertBanner, Menu, InsertMenu,
  MenuItem, InsertMenuItem, Document, InsertDocument,
  ResearchPermit, InsertResearchPermit, Survey, InsertSurvey,
  FinalReport, InsertFinalReport, Suggestion, InsertSuggestion,
} from "@shared/schema";
import { randomUUID } from "crypto";

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

// ─── Request Number Generator ─────────────────────────────────────────────────
async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.requestSequences)
      .where(eq(schema.requestSequences.year, year))
      .for("update");
    if (existing) {
      const newSeq = existing.lastSeq + 1;
      await tx.update(schema.requestSequences)
        .set({ lastSeq: newSeq })
        .where(eq(schema.requestSequences.id, existing.id));
      return newSeq;
    } else {
      await tx.insert(schema.requestSequences).values({ year, lastSeq: 1 });
      return 1;
    }
  });
  return `BAPPERIDA-RID-${year}-${String(result).padStart(6, "0")}`;
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
  updateNews(id: string, data: Partial<InsertNews>): Promise<News>;
  deleteNews(id: string, hard?: boolean): Promise<void>;
  restoreNews(id: string): Promise<void>;

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
  listDocumentCategories(): Promise<any[]>;
  createDocumentCategory(data: { name: string }): Promise<any>;
  updateDocumentCategory(id: string, data: { name: string }): Promise<any>;
  deleteDocumentCategory(id: string): Promise<void>;
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
  toggleNewsStatus(id: string): Promise<News>;

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

  // Generated Letters
  createGeneratedLetter(data: { permitId: string; templateId?: string; fileUrl?: string }): Promise<any>;
  getGeneratedLetter(permitId: string): Promise<any>;

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
    const [r] = await db.insert(schema.users).values(user).returning();
    return r;
  }
  async listUsers() {
    return db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }
  async updateUser(id: string, data: Partial<InsertUser>) {
    const [r] = await db.update(schema.users).set({ ...data, updatedAt: new Date() }).where(eq(schema.users.id, id)).returning();
    return r;
  }

  // ── News Categories ─────────────────────────────────────────────────────────
  async listNewsCategories() {
    return db.select().from(schema.newsCategories).where(isNull(schema.newsCategories.deletedAt)).orderBy(schema.newsCategories.name);
  }
  async createNewsCategory(data: InsertNewsCategory) {
    const slug = data.slug || generateSlug(data.name);
    const [r] = await db.insert(schema.newsCategories).values({ ...data, slug }).returning();
    return r;
  }
  async updateNewsCategory(id: string, data: Partial<InsertNewsCategory>) {
    const [r] = await db.update(schema.newsCategories).set(data).where(eq(schema.newsCategories.id, id)).returning();
    return r;
  }
  async deleteNewsCategory(id: string) {
    await db.update(schema.newsCategories).set({ deletedAt: new Date() }).where(eq(schema.newsCategories.id, id));
  }
  async getNewsCategory(id: string) {
    const [r] = await db.select().from(schema.newsCategories).where(eq(schema.newsCategories.id, id));
    return r;
  }

  // ── News ────────────────────────────────────────────────────────────────────
  async listNews(opts: { page?: number; limit?: number; categoryId?: string; search?: string; status?: string; trash?: boolean } = {}) {
    const { page = 1, limit = 10, categoryId, search, status, trash = false } = opts;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (trash) {
      conditions.push(sql`${schema.news.deletedAt} IS NOT NULL`);
    } else {
      conditions.push(isNull(schema.news.deletedAt));
    }
    if (categoryId) conditions.push(eq(schema.news.categoryId, categoryId));
    if (search) conditions.push(ilike(schema.news.title, `%${search}%`));
    if (status) conditions.push(eq(schema.news.status, status as any));
    const where = and(...conditions);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.news).where(where);
    const items = await db.select().from(schema.news).where(where).orderBy(desc(schema.news.createdAt)).limit(limit).offset(offset);
    return { items, total: Number(count) };
  }
  async getNews(id: string) {
    const [r] = await db.select().from(schema.news).where(eq(schema.news.id, id));
    return r;
  }
  async getNewsBySlug(slug: string) {
    const [r] = await db.select().from(schema.news).where(and(eq(schema.news.slug, slug), isNull(schema.news.deletedAt)));
    return r;
  }
  async createNews(data: InsertNews) {
    const slug = data.slug || generateSlug(data.title);
    const [r] = await db.insert(schema.news).values({ ...data, slug }).returning();
    return r;
  }
  async updateNews(id: string, data: Partial<InsertNews>) {
    const [r] = await db.update(schema.news).set({ ...data, updatedAt: new Date() }).where(eq(schema.news.id, id)).returning();
    return r;
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
    return db.select().from(schema.newsMedia)
      .where(and(eq(schema.newsMedia.newsId, newsId), isNull(schema.newsMedia.deletedAt)))
      .orderBy(schema.newsMedia.sortOrder);
  }
  async createNewsMedia(data: InsertNewsMedia) {
    const [r] = await db.insert(schema.newsMedia).values(data).returning();
    return r;
  }
  async deleteNewsMedia(id: string) {
    const [r] = await db.update(schema.newsMedia).set({ deletedAt: new Date() }).where(eq(schema.newsMedia.id, id)).returning();
    return r;
  }

  // ── Banners ─────────────────────────────────────────────────────────────────
  async listBanners(opts: { trash?: boolean } = {}) {
    if (opts.trash) {
      return db.select().from(schema.banners).where(sql`${schema.banners.deletedAt} IS NOT NULL`).orderBy(desc(schema.banners.createdAt));
    }
    return db.select().from(schema.banners).where(isNull(schema.banners.deletedAt)).orderBy(desc(schema.banners.createdAt));
  }
  async getBanner(id: string) {
    const [r] = await db.select().from(schema.banners).where(eq(schema.banners.id, id));
    return r;
  }
  async createBanner(data: InsertBanner) {
    const [r] = await db.insert(schema.banners).values(data).returning();
    return r;
  }
  async updateBanner(id: string, data: Partial<InsertBanner>) {
    const [r] = await db.update(schema.banners).set({ ...data, updatedAt: new Date() }).where(eq(schema.banners.id, id)).returning();
    return r;
  }
  async deleteBanner(id: string) {
    await db.update(schema.banners).set({ deletedAt: new Date() }).where(eq(schema.banners.id, id));
  }
  async trackBannerView(id: string) {
    await db.update(schema.banners).set({ viewCount: sql`${schema.banners.viewCount} + 1` }).where(eq(schema.banners.id, id));
  }
  async trackBannerClick(id: string) {
    await db.update(schema.banners).set({ clickCount: sql`${schema.banners.clickCount} + 1` }).where(eq(schema.banners.id, id));
  }
  async getActiveBanners() {
    const now = new Date();
    return db.select().from(schema.banners).where(
      and(isNull(schema.banners.deletedAt), eq(schema.banners.isActive, true))
    ).orderBy(desc(schema.banners.createdAt));
  }

  // ── Menus ───────────────────────────────────────────────────────────────────
  async listMenus() {
    return db.select().from(schema.menus).where(isNull(schema.menus.deletedAt)).orderBy(schema.menus.name);
  }
  async getMenu(id: string) {
    const [r] = await db.select().from(schema.menus).where(eq(schema.menus.id, id));
    return r;
  }
  async createMenu(data: InsertMenu) {
    const [r] = await db.insert(schema.menus).values(data).returning();
    return r;
  }
  async updateMenu(id: string, data: Partial<InsertMenu>) {
    const [r] = await db.update(schema.menus).set(data).where(eq(schema.menus.id, id)).returning();
    return r;
  }
  async deleteMenu(id: string) {
    await db.update(schema.menus).set({ deletedAt: new Date() }).where(eq(schema.menus.id, id));
  }
  async listMenuItems(menuId: string) {
    return db.select().from(schema.menuItems)
      .where(and(eq(schema.menuItems.menuId, menuId), isNull(schema.menuItems.deletedAt)))
      .orderBy(schema.menuItems.sortOrder);
  }
  async createMenuItem(data: InsertMenuItem) {
    const [r] = await db.insert(schema.menuItems).values(data).returning();
    return r;
  }
  async updateMenuItem(id: string, data: Partial<InsertMenuItem>) {
    const [r] = await db.update(schema.menuItems).set(data).where(eq(schema.menuItems.id, id)).returning();
    return r;
  }
  async deleteMenuItem(id: string) {
    await db.update(schema.menuItems).set({ deletedAt: new Date() }).where(eq(schema.menuItems.id, id));
  }

  // ── Document Masters ────────────────────────────────────────────────────────
  async listDocumentKinds() {
    return db.select().from(schema.documentKinds).where(isNull(schema.documentKinds.deletedAt)).orderBy(schema.documentKinds.name);
  }
  async createDocumentKind(data: { name: string }) {
    const [r] = await db.insert(schema.documentKinds).values({ name: data.name }).returning();
    return r;
  }
  async updateDocumentKind(id: string, data: { name: string }) {
    const [r] = await db.update(schema.documentKinds).set({ name: data.name }).where(eq(schema.documentKinds.id, id)).returning();
    return r;
  }
  async deleteDocumentKind(id: string) {
    await db.update(schema.documentKinds).set({ deletedAt: new Date() }).where(eq(schema.documentKinds.id, id));
  }
  async listDocumentCategories() {
    return db.select().from(schema.documentCategories).where(isNull(schema.documentCategories.deletedAt)).orderBy(schema.documentCategories.name);
  }
  async createDocumentCategory(data: { name: string }) {
    const [r] = await db.insert(schema.documentCategories).values({ name: data.name }).returning();
    return r;
  }
  async updateDocumentCategory(id: string, data: { name: string }) {
    const [r] = await db.update(schema.documentCategories).set({ name: data.name }).where(eq(schema.documentCategories.id, id)).returning();
    return r;
  }
  async deleteDocumentCategory(id: string) {
    await db.update(schema.documentCategories).set({ deletedAt: new Date() }).where(eq(schema.documentCategories.id, id));
  }
  async listDocumentTypes() {
    return db.select().from(schema.documentTypes).where(isNull(schema.documentTypes.deletedAt)).orderBy(schema.documentTypes.name);
  }
  async createDocumentType(data: { name: string; extension?: string }) {
    const [r] = await db.insert(schema.documentTypes).values({ name: data.name, extension: data.extension }).returning();
    return r;
  }
  async updateDocumentType(id: string, data: { name: string; extension?: string }) {
    const [r] = await db.update(schema.documentTypes).set({ name: data.name, extension: data.extension }).where(eq(schema.documentTypes.id, id)).returning();
    return r;
  }
  async deleteDocumentType(id: string) {
    await db.update(schema.documentTypes).set({ deletedAt: new Date() }).where(eq(schema.documentTypes.id, id));
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  async listDocuments(opts: { page?: number; limit?: number; search?: string; trash?: boolean; kindId?: string; categoryId?: string; typeId?: string } = {}) {
    const { page = 1, limit = 10, search, trash = false, kindId, categoryId, typeId } = opts;
    const offset = (page - 1) * limit;
    const conditions = trash
      ? [sql`${schema.documents.deletedAt} IS NOT NULL`]
      : [isNull(schema.documents.deletedAt)];
    if (search) conditions.push(ilike(schema.documents.title, `%${search}%`));
    if (kindId) conditions.push(eq(schema.documents.kindId, kindId));
    if (categoryId) conditions.push(eq(schema.documents.categoryId, categoryId));
    if (typeId) conditions.push(eq(schema.documents.typeId, typeId));
    const where = and(...conditions);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.documents).where(where);
    const items = await db.select().from(schema.documents).where(where).orderBy(desc(schema.documents.createdAt)).limit(limit).offset(offset);
    return { items, total: Number(count) };
  }
  async getDocument(id: string) {
    const [r] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return r;
  }
  async createDocument(data: InsertDocument) {
    const [r] = await db.insert(schema.documents).values(data).returning();
    return r;
  }
  async updateDocument(id: string, data: Partial<InsertDocument>) {
    const [r] = await db.update(schema.documents).set({ ...data, updatedAt: new Date() }).where(eq(schema.documents.id, id)).returning();
    return r;
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
    const [r] = await db.update(schema.news).set({ status: newStatus as any, publishedAt, updatedAt: new Date() }).where(eq(schema.news.id, id)).returning();
    return r;
  }

  // ── Research Permits ────────────────────────────────────────────────────────
  async listPermits(opts: { page?: number; limit?: number; status?: string; search?: string } = {}) {
    const { page = 1, limit = 10, status, search } = opts;
    const offset = (page - 1) * limit;
    const conditions = [isNull(schema.researchPermitRequests.deletedAt)];
    if (status) conditions.push(eq(schema.researchPermitRequests.status, status as any));
    if (search) conditions.push(or(
      ilike(schema.researchPermitRequests.fullName, `%${search}%`),
      ilike(schema.researchPermitRequests.researchTitle, `%${search}%`),
      ilike(schema.researchPermitRequests.requestNumber, `%${search}%`),
    )!);
    const where = and(...conditions);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.researchPermitRequests).where(where);
    const items = await db.select().from(schema.researchPermitRequests).where(where).orderBy(desc(schema.researchPermitRequests.createdAt)).limit(limit).offset(offset);
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
  async createPermit(data: InsertResearchPermit) {
    const requestNumber = await generateRequestNumber();
    const [r] = await db.insert(schema.researchPermitRequests).values({ ...data, requestNumber }).returning();
    await this.addPermitStatusHistory({ permitId: r.id, fromStatus: null, toStatus: "submitted" });
    return r;
  }
  async updatePermitStatus(id: string, status: string, note?: string, processedBy?: string) {
    const current = await this.getPermit(id);
    const [r] = await db.update(schema.researchPermitRequests)
      .set({ status: status as any, reviewNote: note, processedBy, updatedAt: new Date() })
      .where(eq(schema.researchPermitRequests.id, id)).returning();
    await this.addPermitStatusHistory({ permitId: id, fromStatus: current?.status || null, toStatus: status, note, changedBy: processedBy });
    return r;
  }
  async updatePermit(id: string, data: Partial<ResearchPermit>) {
    const [r] = await db.update(schema.researchPermitRequests).set({ ...data, updatedAt: new Date() }).where(eq(schema.researchPermitRequests.id, id)).returning();
    return r;
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
    const [r] = await db.insert(schema.letterTemplates).values(data).returning();
    return r;
  }
  async updateTemplate(id: string, data: any) {
    const [r] = await db.update(schema.letterTemplates).set({ ...data, updatedAt: new Date() }).where(eq(schema.letterTemplates.id, id)).returning();
    return r;
  }

  // ── Generated Letters ───────────────────────────────────────────────────────
  async createGeneratedLetter(data: { permitId: string; templateId?: string; fileUrl?: string }) {
    const [r] = await db.insert(schema.generatedLetters).values(data).returning();
    return r;
  }
  async getGeneratedLetter(permitId: string) {
    const [r] = await db.select().from(schema.generatedLetters)
      .where(and(eq(schema.generatedLetters.permitId, permitId), isNull(schema.generatedLetters.deletedAt)))
      .orderBy(desc(schema.generatedLetters.createdAt));
    return r;
  }

  // ── Surveys ─────────────────────────────────────────────────────────────────
  async createSurvey(data: InsertSurvey) {
    const [r] = await db.insert(schema.surveys).values(data).returning();
    return r;
  }
  async listSurveys(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.surveys);
    const items = await db.select().from(schema.surveys).orderBy(desc(schema.surveys.createdAt)).limit(limit).offset(offset);
    return { items, total: Number(count) };
  }

  // ── Final Reports ───────────────────────────────────────────────────────────
  async createFinalReport(data: InsertFinalReport) {
    const [r] = await db.insert(schema.finalReports).values(data).returning();
    return r;
  }
  async listFinalReports(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.finalReports);
    const items = await db.select().from(schema.finalReports).orderBy(desc(schema.finalReports.createdAt)).limit(limit).offset(offset);
    return { items, total: Number(count) };
  }

  // ── Suggestions ─────────────────────────────────────────────────────────────
  async createSuggestion(data: InsertSuggestion) {
    const [r] = await db.insert(schema.suggestionBox).values(data).returning();
    return r;
  }
  async listSuggestions(opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 10 } = opts;
    const offset = (page - 1) * limit;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.suggestionBox);
    const items = await db.select().from(schema.suggestionBox).orderBy(desc(schema.suggestionBox.createdAt)).limit(limit).offset(offset);
    return { items, total: Number(count) };
  }

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  async getDashboardStats() {
    const [newsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.news).where(isNull(schema.news.deletedAt));
    const [newsTrash] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.news).where(sql`${schema.news.deletedAt} IS NOT NULL`);
    const [publishedNews] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.news).where(and(isNull(schema.news.deletedAt), eq(schema.news.status, "published")));
    const [permitCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.researchPermitRequests).where(isNull(schema.researchPermitRequests.deletedAt));
    const [pendingPermits] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.researchPermitRequests).where(and(isNull(schema.researchPermitRequests.deletedAt), eq(schema.researchPermitRequests.status, "submitted")));
    const [surveyCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.surveys);
    const [bannerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.banners).where(isNull(schema.banners.deletedAt));
    const [docCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.documents).where(isNull(schema.documents.deletedAt));
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
}

export const storage = new DatabaseStorage();
