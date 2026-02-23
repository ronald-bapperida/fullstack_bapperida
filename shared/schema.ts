import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, boolean, integer, timestamp, pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["super_admin", "admin_bpp", "admin_rida"]);
export const newsStatusEnum = pgEnum("news_status", ["draft", "published"]);
export const permitStatusEnum = pgEnum("permit_status", [
  "submitted", "in_review", "revision_requested", "approved",
  "generated_letter", "sent", "rejected"
]);
export const bannerLinkTypeEnum = pgEnum("banner_link_type", ["external", "page", "news"]);
export const menuLocationEnum = pgEnum("menu_location", ["header", "footer", "mobile"]);
export const menuItemTypeEnum = pgEnum("menu_item_type", ["route", "url", "page", "news"]);
export const accessLevelEnum = pgEnum("access_level", ["terbuka", "terbatas", "rahasia"]);
export const genderEnum = pgEnum("gender", ["laki_laki", "perempuan"]);
export const citizenshipEnum = pgEnum("citizenship", ["WNI", "WNA"]);

// ─── Users & Auth ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull().default("admin_bpp"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── News Categories ──────────────────────────────────────────────────────────
export const newsCategories = pgTable("news_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsCategorySchema = createInsertSchema(newsCategories).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertNewsCategory = z.infer<typeof insertNewsCategorySchema>;
export type NewsCategory = typeof newsCategories.$inferSelect;

// ─── News ─────────────────────────────────────────────────────────────────────
export const news = pgTable("news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  categoryId: varchar("category_id").references(() => newsCategories.id),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  url: text("url"),
  featuredImage: text("featured_image"),
  featuredCaption: text("featured_caption"),
  status: newsStatusEnum("status").notNull().default("draft"),
  eventAt: timestamp("event_at"),
  publishedAt: timestamp("published_at"),
  authorId: varchar("author_id").references(() => users.id),
  viewCount: integer("view_count").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsSchema = createInsertSchema(news).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, viewCount: true });
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type News = typeof news.$inferSelect;

// ─── News Media ───────────────────────────────────────────────────────────────
export const newsMedia = pgTable("news_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsId: varchar("news_id").notNull().references(() => news.id),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  insertAfterParagraph: integer("insert_after_paragraph").default(0),
  sortOrder: integer("sort_order").default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsMediaSchema = createInsertSchema(newsMedia).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertNewsMedia = z.infer<typeof insertNewsMediaSchema>;
export type NewsMedia = typeof newsMedia.$inferSelect;

// ─── Banners ──────────────────────────────────────────────────────────────────
export const banners = pgTable("banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  placement: text("placement").notNull().default("home"),
  imageDesktop: text("image_desktop"),
  imageMobile: text("image_mobile"),
  linkType: bannerLinkTypeEnum("link_type").notNull().default("external"),
  linkUrl: text("link_url"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  isActive: boolean("is_active").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBannerSchema = createInsertSchema(banners).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, viewCount: true, clickCount: true });
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// ─── Menus ────────────────────────────────────────────────────────────────────
export const menus = pgTable("menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: menuLocationEnum("location").notNull().default("header"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMenuSchema = createInsertSchema(menus).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type Menu = typeof menus.$inferSelect;

export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuId: varchar("menu_id").notNull().references(() => menus.id),
  parentId: varchar("parent_id"),
  title: text("title").notNull(),
  type: menuItemTypeEnum("type").notNull().default("url"),
  value: text("value"),
  requiresAuth: boolean("requires_auth").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// ─── Document Masters ─────────────────────────────────────────────────────────
export const documentKinds = pgTable("document_kinds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentCategories = pgTable("document_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Documents (PPID) ─────────────────────────────────────────────────────────
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  kindId: varchar("kind_id").references(() => documentKinds.id),
  categoryId: varchar("category_id").references(() => documentCategories.id),
  typeId: varchar("type_id").references(() => documentTypes.id),
  fileUrl: text("file_url"),
  accessLevel: accessLevelEnum("access_level").notNull().default("terbuka"),
  publishedAt: timestamp("published_at"),
  status: newsStatusEnum("status").notNull().default("draft"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ─── Research Permit ──────────────────────────────────────────────────────────
export const requestSequences = pgTable("request_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const researchPermitRequests = pgTable("research_permit_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: text("request_number").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  nimNik: text("nim_nik").notNull(),
  birthPlace: text("birth_place").notNull(),
  workUnit: text("work_unit").notNull(),
  institution: text("institution").notNull(),
  phoneWa: text("phone_wa").notNull(),
  citizenship: citizenshipEnum("citizenship").notNull().default("WNI"),
  researchLocation: text("research_location").notNull(),
  researchDuration: text("research_duration").notNull(),
  researchTitle: text("research_title").notNull(),
  signerPosition: text("signer_position").notNull(),
  introLetterNumber: text("intro_letter_number").notNull(),
  introLetterDate: timestamp("intro_letter_date").notNull(),
  fileIdentity: text("file_identity"),
  fileIntroLetter: text("file_intro_letter"),
  fileProposal: text("file_proposal"),
  fileSocialMedia: text("file_social_media"),
  fileSurvey: text("file_survey"),
  agreementFinalReport: boolean("agreement_final_report").notNull().default(false),
  status: permitStatusEnum("status").notNull().default("submitted"),
  reviewNote: text("review_note"),
  processedBy: varchar("processed_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertResearchPermitSchema = createInsertSchema(researchPermitRequests).omit({
  id: true, requestNumber: true, status: true, reviewNote: true, processedBy: true,
  deletedAt: true, createdAt: true, updatedAt: true,
});
export type InsertResearchPermit = z.infer<typeof insertResearchPermitSchema>;
export type ResearchPermit = typeof researchPermitRequests.$inferSelect;

export const permitStatusHistories = pgTable("permit_status_histories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").notNull().references(() => researchPermitRequests.id),
  fromStatus: permitStatusEnum("from_status"),
  toStatus: permitStatusEnum("to_status").notNull(),
  note: text("note"),
  changedBy: varchar("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Letter Templates & Generated Letters ─────────────────────────────────────
export const letterTemplates = pgTable("letter_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const generatedLetters = pgTable("generated_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permitId: varchar("permit_id").notNull().references(() => researchPermitRequests.id),
  templateId: varchar("template_id").references(() => letterTemplates.id),
  fileUrl: text("file_url"),
  sentAt: timestamp("sent_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Surveys (IKM) ────────────────────────────────────────────────────────────
export const surveys = pgTable("surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  respondentName: text("respondent_name").notNull(),
  age: integer("age").notNull(),
  gender: genderEnum("gender").notNull(),
  education: text("education").notNull(),
  occupation: text("occupation").notNull(),
  q1: integer("q1").notNull(),
  q2: integer("q2").notNull(),
  q3: integer("q3").notNull(),
  q4: integer("q4").notNull(),
  q5: integer("q5").notNull(),
  q6: integer("q6").notNull(),
  q7: integer("q7").notNull(),
  q8: integer("q8").notNull(),
  q9: integer("q9").notNull(),
  suggestion: text("suggestion"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, createdAt: true });
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveys.$inferSelect;

// ─── Final Reports & Suggestion Box ──────────────────────────────────────────
export const finalReports = pgTable("final_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  researchTitle: text("research_title").notNull(),
  permitRequestId: varchar("permit_request_id").references(() => researchPermitRequests.id),
  fileUrl: text("file_url"),
  suggestion: text("suggestion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFinalReportSchema = createInsertSchema(finalReports).omit({ id: true, createdAt: true });
export type InsertFinalReport = z.infer<typeof insertFinalReportSchema>;
export type FinalReport = typeof finalReports.$inferSelect;

export const suggestionBox = pgTable("suggestion_box", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSuggestionSchema = createInsertSchema(suggestionBox).omit({ id: true, createdAt: true });
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestionBox.$inferSelect;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: text("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});
