import { sql } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  int,
  timestamp,
  mysqlEnum,
  json,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- values ---
export const roleValues = ["super_admin", "admin_bpp", "admin_rida", "user"] as const;
export const newsStatusValues = ["draft", "published"] as const;
export const permitStatusValues = [
  "submitted",
  "in_review",
  "revision_requested",
  "approved",
  "generated_letter",
  "sent",
  "rejected",
] as const;

export const bannerLinkTypeValues = ["external", "page", "news"] as const;
export const menuLocationValues = ["header", "footer", "mobile"] as const;
export const menuItemTypeValues = ["route", "url", "page", "news"] as const;
export const accessLevelValues = ["terbuka", "terbatas", "rahasia"] as const;
export const genderValues = ["laki_laki", "perempuan"] as const;
export const citizenshipValues = ["WNI", "WNA"] as const;

// --- mysql enum helpers (column factories) ---
export const role = (name: string) => mysqlEnum(name, roleValues);
export const newsStatus = (name: string) => mysqlEnum(name, newsStatusValues);
export const permitStatus = (name: string) => mysqlEnum(name, permitStatusValues);
export const bannerLinkType = (name: string) => mysqlEnum(name, bannerLinkTypeValues);
export const menuLocation = (name: string) => mysqlEnum(name, menuLocationValues);
export const menuItemType = (name: string) => mysqlEnum(name, menuItemTypeValues);
export const accessLevel = (name: string) => mysqlEnum(name, accessLevelValues);
export const gender = (name: string) => mysqlEnum(name, genderValues);
export const citizenship = (name: string) => mysqlEnum(name, citizenshipValues);

const uuidDefault = sql`(UUID())`;

// ─── Users & Auth ─────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),

  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 191 }).notNull().unique(),

  phone: varchar("phone", { length: 20 }),

  password: text("password").notNull(),
  fullName: varchar("full_name", { length: 191 }).notNull(),

  role: role("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── News Categories ──────────────────────────────────────────────────────────
export const newsCategories = mysqlTable("news_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  description: text("description"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsCategorySchema = createInsertSchema(newsCategories).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertNewsCategory = z.infer<typeof insertNewsCategorySchema>;
export type NewsCategory = typeof newsCategories.$inferSelect;

// ─── News ─────────────────────────────────────────────────────────────────────
export const news = mysqlTable("news", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  categoryId: varchar("category_id", { length: 36 }).references(() => newsCategories.id),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  url: text("url"),
  featuredImage: text("featured_image"),
  featuredCaption: text("featured_caption"),
  status: newsStatus("status").notNull().default("draft"),
  eventAt: timestamp("event_at"),
  publishedAt: timestamp("published_at"),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id),
  viewCount: int("view_count").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsSchema = createInsertSchema(news).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  viewCount: true,
});
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type News = typeof news.$inferSelect;

// ─── News Media ───────────────────────────────────────────────────────────────
export const newsMedia = mysqlTable("news_media", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  newsId: varchar("news_id", { length: 36 }).notNull().references(() => news.id),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: int("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  caption: text("caption"),
  isMain: boolean("is_main").notNull().default(false),
  type: text("type").notNull().default("image"),
  insertAfterParagraph: int("insert_after_paragraph").default(0),
  sortOrder: int("sort_order").default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsMediaSchema = createInsertSchema(newsMedia).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertNewsMedia = z.infer<typeof insertNewsMediaSchema>;
export type NewsMedia = typeof newsMedia.$inferSelect;

// ─── Banners ──────────────────────────────────────────────────────────────────
export const banners = mysqlTable("banners", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 191 }),
  placement: varchar("placement", { length: 50 }).notNull().default("home"),
  imageDesktop: text("image_desktop"),
  imageMobile: text("image_mobile"),
  altText: varchar("alt_text", { length: 191 }),
  linkType: bannerLinkType("link_type").notNull().default("external"),
  linkUrl: text("link_url"),
  target: varchar("target", { length: 20 }).notNull().default("_self"),
  sortOrder: int("sort_order").notNull().default(0),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  isActive: boolean("is_active").notNull().default(true),
  viewCount: int("view_count").notNull().default(0),
  clickCount: int("click_count").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBannerSchema = createInsertSchema(banners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  viewCount: true,
  clickCount: true,
});
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// ─── Menus ────────────────────────────────────────────────────────────────────
export const menus = mysqlTable("menus", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  location: menuLocation("location").notNull().default("header"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMenuSchema = createInsertSchema(menus).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type Menu = typeof menus.$inferSelect;

export const menuItems = mysqlTable("menu_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  menuId: varchar("menu_id", { length: 36 }).notNull().references(() => menus.id),
  parentId: varchar("parent_id", { length: 36 }),
  title: text("title").notNull(),
  type: menuItemType("type").notNull().default("url"),
  value: text("value"),
  icon: text("icon"),
  target: text("target").notNull().default("_self"),
  requiresAuth: boolean("requires_auth").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// ─── Document Masters ─────────────────────────────────────────────────────────
export const documentKinds = mysqlTable("document_kinds", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentCategories = mysqlTable("document_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  level: int("level"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentTypes = mysqlTable("document_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  extension: text("extension"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentRequests = mysqlTable("document_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  documentId: varchar("document_id", { length: 36 }).notNull().references(() => documents.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  purpose: text("purpose").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertDocumentRequestSchema = createInsertSchema(
  documentRequests
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;
export type DocumentRequest = typeof documentRequests.$inferSelect;

// ─── Documents (PPID) ─────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title: text("title").notNull(),
  docNo: text("doc_no"),
  kindId: varchar("kind_id", { length: 36 }).references(() => documentKinds.id),
  categoryId: varchar("category_id", { length: 36 }).references(() => documentCategories.id),
  typeId: varchar("type_id", { length: 36 }).references(() => documentTypes.id),
  publisher: text("publisher"),
  content: text("content"),
  fileUrl: text("file_url"),
  filePath: text("file_path"),
  downloadedCount: int("downloaded_count").notNull().default(0),
  accessLevel: accessLevel("access_level").notNull().default("terbuka"),
  publishedAt: timestamp("published_at"),
  status: newsStatus("status").notNull().default("draft"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  downloadedCount: true
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ─── Research Permit ──────────────────────────────────────────────────────────
export const requestSequences = mysqlTable("request_sequences", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  year: int("year").notNull(),
  lastSeq: int("last_seq").notNull().default(0),
});

export const researchPermitRequests = mysqlTable("research_permit_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  requestNumber: varchar("request_number",{ length: 64 }).notNull().unique(),
  email: varchar("email", { length: 191 }).notNull(),
  fullName: text("full_name").notNull(),
  nimNik: varchar("nim_nik", { length: 32 }).notNull(),
  birthPlace: varchar("birth_place", { length: 100 }).notNull(),
  workUnit: varchar("work_unit", { length: 191 }).notNull(),
  institution: varchar("institution", { length: 191 }).notNull(),
  phoneWa: varchar("phone_wa", { length: 32 }).notNull(),
  citizenship: citizenship("citizenship").notNull().default("WNI"),
  researchLocation: varchar("research_location", { length: 191 }).notNull(),
  researchDuration: varchar("research_duration", { length: 50 }).notNull(),
  researchTitle: text("research_title").notNull(),
  signerPosition: varchar("signer_position", { length: 100 }).notNull(),
  introLetterNumber: varchar("intro_letter_number", { length: 64 }).notNull(),
  introLetterDate: timestamp("intro_letter_date").notNull(),
  fileIdentity: text("file_identity"),
  fileIntroLetter: text("file_intro_letter"),
  fileProposal: text("file_proposal"),
  fileSocialMedia: text("file_social_media"),
  fileSurvey: text("file_survey"),
  agreementFinalReport: boolean("agreement_final_report").notNull().default(false),
  status: permitStatus("status").notNull().default("submitted"),
  reviewNote: text("review_note"),
  processedBy: varchar("processed_by", { length: 36 }).references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertResearchPermitSchema = createInsertSchema(researchPermitRequests).omit({
  id: true,
  requestNumber: true,
  status: true,
  reviewNote: true,
  processedBy: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertResearchPermit = z.infer<typeof insertResearchPermitSchema>;
export type ResearchPermit = typeof researchPermitRequests.$inferSelect;

export const permitStatusHistories = mysqlTable("permit_status_histories", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  permitId: varchar("permit_id", { length: 36 }).notNull().references(() => researchPermitRequests.id),
  fromStatus: permitStatus("from_status"),
  toStatus: permitStatus("to_status").notNull(),
  note: text("note"),
  changedBy: varchar("changed_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Letter Templates & Generated Letters ─────────────────────────────────────
export const letterTemplates = mysqlTable("letter_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  type: text("type").notNull().default("research_permit"),
  content: text("content").notNull(),
  placeholders: text("placeholders"),
  isActive: boolean("is_active").notNull().default(true),
  // Dynamic letter config
  officialName: text("official_name"),
  officialPosition: text("official_position"),
  officialNip: text("official_nip"),
  city: text("city").default("Palangka Raya"),
  tembusan: text("tembusan"),
  kepada: text("kepada"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const letterTemplateFiles = mysqlTable("letter_template_files", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),

  templateId: varchar("template_id", { length: 36 })
    .notNull()
    .references(() => letterTemplates.id),

  fileUrl: text("file_url").notNull(),
  filePath: text("file_path").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export const generatedLetters = mysqlTable("generated_letters", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  permitId: varchar("permit_id", { length: 36 }).notNull().references(() => researchPermitRequests.id),
  templateId: varchar("template_id", { length: 36 }).references(() => letterTemplates.id),
  fileUrl: text("file_url"),
  letterNumber: text("letter_number"),
  letterDate: timestamp("letter_date"),
  dataSnapshot: text("data_snapshot"),
  generatedBy: varchar("generated_by", { length: 36 }).references(() => users.id),
  generatedAt: timestamp("generated_at"),
  sentAt: timestamp("sent_at"),
  sentToEmail: text("sent_to_email"),
  sendError: text("send_error"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Surveys (IKM) ────────────────────────────────────────────────────────────
export const surveys = mysqlTable("surveys", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  respondentName: text("respondent_name").notNull(),
  age: int("age").notNull(),
  gender: gender("gender").notNull(),
  education: text("education").notNull(),
  occupation: text("occupation").notNull(),
  q1: int("q1").notNull(),
  q2: int("q2").notNull(),
  q3: int("q3").notNull(),
  q4: int("q4").notNull(),
  q5: int("q5").notNull(),
  q6: int("q6").notNull(),
  q7: int("q7").notNull(),
  q8: int("q8").notNull(),
  q9: int("q9").notNull(),
  suggestion: text("suggestion"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSurveySchema = createInsertSchema(surveys).omit({
  id: true,
  createdAt: true,
});
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveys.$inferSelect;

// ─── Final Reports & Suggestion Box ──────────────────────────────────────────
export const finalReports = mysqlTable("final_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name").notNull(),
  email: text("email").notNull(),
  researchTitle: text("research_title").notNull(),
  permitRequestId: varchar("permit_request_id", { length: 36 }).references(() => researchPermitRequests.id),
  fileUrl: text("file_url"),
  suggestion: text("suggestion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFinalReportSchema = createInsertSchema(finalReports).omit({
  id: true,
  createdAt: true,
});
export type InsertFinalReport = z.infer<typeof insertFinalReportSchema>;
export type FinalReport = typeof finalReports.$inferSelect;

export const suggestionBox = mysqlTable("suggestion_box", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name: text("name"),
  email: text("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSuggestionSchema = createInsertSchema(suggestionBox).omit({
  id: true,
  createdAt: true,
});
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestionBox.$inferSelect;

// ─── PPID Keberatan (Objection) ───────────────────────────────────────────────
export const ppidObjectionStatusValues = ["pending", "in_review", "resolved", "rejected"] as const;

export const ppidObjections = mysqlTable("ppid_objections", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  requestCode: varchar("request_code", { length: 64 }),
  fullName: text("full_name").notNull(),
  nik: varchar("nik", { length: 20 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 191 }),
  occupation: varchar("occupation", { length: 191 }),
  ktpFileUrl: text("ktp_file_url"),
  informationDetail: text("information_detail").notNull(),
  requestPurpose: text("request_purpose").notNull(),
  objectionReasons: json("objection_reasons").$type<string[]>(),
  objectionNote: text("objection_note"),
  evidenceFileUrl: text("evidence_file_url"),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  processedBy: varchar("processed_by", { length: 36 }).references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPpidObjectionSchema = createInsertSchema(ppidObjections).omit({
  id: true,
  status: true,
  reviewNote: true,
  processedBy: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPpidObjection = z.infer<typeof insertPpidObjectionSchema>;
export type PpidObjection = typeof ppidObjections.$inferSelect;

// ─── PPID Permohonan Informasi ────────────────────────────────────────────────
export const ppidInfoRequestStatusValues = ["pending", "in_review", "resolved", "rejected"] as const;

export const ppidInformationRequests = mysqlTable("ppid_information_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  token: varchar("token", { length: 16 }),
  fullName: text("full_name").notNull(),
  nik: varchar("nik", { length: 20 }).notNull(),
  address: text("address").notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 191 }),
  occupation: varchar("occupation", { length: 191 }),
  ktpFileUrl: text("ktp_file_url"),
  informationDetail: text("information_detail").notNull(),
  requestPurpose: text("request_purpose").notNull(),
  retrievalMethod: varchar("retrieval_method", { length: 50 }),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  responseFileUrl: text("response_file_url"),
  processedBy: varchar("processed_by", { length: 36 }).references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPpidInfoRequestSchema = createInsertSchema(ppidInformationRequests).omit({
  id: true,
  status: true,
  reviewNote: true,
  processedBy: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPpidInfoRequest = z.infer<typeof insertPpidInfoRequestSchema>;
export type PpidInfoRequest = typeof ppidInformationRequests.$inferSelect;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: text("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});
