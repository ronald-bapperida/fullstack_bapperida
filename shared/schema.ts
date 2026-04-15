import { sql } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  int,
  timestamp,
  json,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- enum values ---
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
export const genderValues = ["laki-laki", "perempuan"] as const;
export const citizenshipValues = ["WNI", "WNA"] as const;

// MySQL UUID default
const uuidDefault = sql`(UUID())`;

// ─── Users & Auth ─────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  username:  varchar("username", { length: 64 }).notNull().unique(),
  email:     varchar("email", { length: 191 }).notNull().unique(),
  phone:     varchar("phone", { length: 20 }),
  password:  text("password").notNull(),
  fullName:  varchar("full_name", { length: 191 }).notNull(),
  role:      varchar("role", { length: 30 }).notNull().default("user"),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Password Reset OTPs ──────────────────────────────────────────────────────
export const passwordResetOtps = mysqlTable("password_reset_otps", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:    varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  otp:       varchar("otp", { length: 6 }).notNull(),
  verified:  boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── News Categories ──────────────────────────────────────────────────────────
export const newsCategories = mysqlTable("news_categories", {
  id:          varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:        text("name").notNull(),
  slug:        varchar("slug", { length: 191 }).notNull().unique(),
  description: text("description"),
  deletedAt:   timestamp("deleted_at"),
  createdAt:   timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertNewsCategorySchema = createInsertSchema(newsCategories).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertNewsCategory = z.infer<typeof insertNewsCategorySchema>;
export type NewsCategory = typeof newsCategories.$inferSelect;

// ─── News ─────────────────────────────────────────────────────────────────────
export const news = mysqlTable("news", {
  id:              varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title:           text("title").notNull(),
  slug:            varchar("slug", { length: 191 }).notNull().unique(),
  categoryId:      varchar("category_id", { length: 36 }).references(() => newsCategories.id),
  content:         text("content").notNull(),
  excerpt:         text("excerpt"),
  url:             text("url"),
  featuredImage:   text("featured_image"),
  featuredCaption: text("featured_caption"),
  status:          varchar("status", { length: 20 }).notNull().default("draft"),
  eventAt:         timestamp("event_at"),
  publishedAt:     timestamp("published_at"),
  authorId:        varchar("author_id", { length: 36 }).references(() => users.id),
  viewCount:       int("view_count").notNull().default(0),
  deletedAt:       timestamp("deleted_at"),
  createdAt:       timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:       timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertNewsSchema = createInsertSchema(news).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, viewCount: true });
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type News = typeof news.$inferSelect;

// ─── News Media ───────────────────────────────────────────────────────────────
export const newsMedia = mysqlTable("news_media", {
  id:                   varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  newsId:               varchar("news_id", { length: 36 }).notNull().references(() => news.id),
  fileUrl:              text("file_url").notNull(),
  fileName:             text("file_name").notNull(),
  fileSize:             int("file_size").notNull(),
  mimeType:             text("mime_type").notNull(),
  caption:              text("caption"),
  isMain:               boolean("is_main").notNull().default(false),
  type:                 text("type").notNull().default("image"),
  insertAfterParagraph: int("insert_after_paragraph").default(0),
  sortOrder:            int("sort_order").default(0),
  deletedAt:            timestamp("deleted_at"),
  createdAt:            timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type NewsMedia = typeof newsMedia.$inferSelect;
export type InsertNewsMedia = typeof newsMedia.$inferInsert;

// ─── Banners ──────────────────────────────────────────────────────────────────
export const banners = mysqlTable("banners", {
  id:           varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title:        text("title").notNull(),
  slug:         varchar("slug", { length: 191 }),
  placement:    varchar("placement", { length: 50 }).notNull().default("home"),
  imageDesktop: text("image_desktop"),
  imageMobile:  text("image_mobile"),
  altText:      varchar("alt_text", { length: 191 }),
  linkType:     varchar("link_type", { length: 20 }).notNull().default("external"),
  linkUrl:      text("link_url"),
  target:       varchar("target", { length: 20 }).notNull().default("_self"),
  sortOrder:    int("sort_order").notNull().default(0),
  startAt:      timestamp("start_at"),
  endAt:        timestamp("end_at"),
  isActive:     boolean("is_active").notNull().default(true),
  viewCount:    int("view_count").notNull().default(0),
  clickCount:   int("click_count").notNull().default(0),
  deletedAt:    timestamp("deleted_at"),
  createdAt:    timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:    timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertBannerSchema = createInsertSchema(banners).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, viewCount: true, clickCount: true });
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// ─── Menus ────────────────────────────────────────────────────────────────────
export const menus = mysqlTable("menus", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:      text("name").notNull(),
  location:  varchar("location", { length: 30 }).notNull().default("header"),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Menu = typeof menus.$inferSelect;
export type InsertMenu = typeof menus.$inferInsert;

export const menuItems = mysqlTable("menu_items", {
  id:           varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  menuId:       varchar("menu_id", { length: 36 }).notNull().references(() => menus.id),
  parentId:     varchar("parent_id", { length: 36 }),
  title:        text("title").notNull(),
  type:         varchar("type", { length: 20 }).notNull().default("route"),
  value:        text("value"),
  icon:         text("icon"),
  target:       text("target"),
  requiresAuth: boolean("requires_auth").notNull().default(false),
  sortOrder:    int("sort_order").notNull().default(0),
  deletedAt:    timestamp("deleted_at"),
  createdAt:    timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

// ─── Document Archive ──────────────────────────────────────────────────────────
export const documentCategories = mysqlTable("document_categories", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:      text("name").notNull(),
  level:     int("level"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const documentKinds = mysqlTable("document_kinds", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:      text("name").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const documentTypes = mysqlTable("document_types", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:      text("name").notNull(),
  extension: text("extension"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const documentRequests = mysqlTable("document_requests", {
  id:         varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:     varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  documentId: varchar("document_id", { length: 36 }).notNull(),
  name:       text("name").notNull(),
  email:      text("email").notNull(),
  phone:      text("phone").notNull(),
  purpose:    text("purpose").notNull(),
  deletedAt:  timestamp("deleted_at"),
  createdAt:  timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:  timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const insertDocumentRequestSchema = createInsertSchema(documentRequests).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;
export type DocumentRequest = typeof documentRequests.$inferSelect;

export const documents = mysqlTable("documents", {
  id:              varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  title:           text("title").notNull(),
  docNo:           text("doc_no"),
  kindId:          varchar("kind_id", { length: 36 }).references(() => documentKinds.id),
  categoryId:      varchar("category_id", { length: 36 }).references(() => documentCategories.id),
  typeId:          varchar("type_id", { length: 36 }).references(() => documentTypes.id),
  publisher:       text("publisher"),
  content:         text("content"),
  fileUrl:         text("file_url"),
  filePath:        text("file_path"),
  downloadedCount: int("downloaded_count").notNull().default(0),
  accessLevel:     varchar("access_level", { length: 20 }).notNull().default("terbuka"),
  publishedAt:     timestamp("published_at"),
  status:          varchar("status", { length: 20 }).notNull().default("draft"),
  deletedAt:       timestamp("deleted_at"),
  createdAt:       timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:       timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, downloadedCount: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ─── Research Permit ──────────────────────────────────────────────────────────
export const requestSequences = mysqlTable("request_sequences", {
  id:      varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  year:    int("year").notNull(),
  lastSeq: int("last_seq").notNull().default(0),
});

export const researchPermitRequests = mysqlTable("research_permit_requests", {
  id:              varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  requestNumber:   varchar("request_number", { length: 64 }).notNull().unique(),
  email:           varchar("email", { length: 191 }).notNull(),
  fullName:        text("full_name").notNull(),
  nimNik:          varchar("nim_nik", { length: 32 }).notNull(),
  birthPlace:      varchar("birth_place", { length: 100 }).notNull(),
  workUnit:        varchar("work_unit", { length: 191 }).notNull(),
  institution:     varchar("institution", { length: 191 }).notNull(),
  phoneWa:         varchar("phone_wa", { length: 32 }).notNull(),
  citizenship:     varchar("citizenship", { length: 10 }).notNull().default("WNI"),
  researchLocation:  varchar("research_location", { length: 191 }).notNull(),
  researchDuration:  varchar("research_duration", { length: 50 }).notNull(),
  researchStartDate: timestamp("research_start_date"),
  researchEndDate:   timestamp("research_end_date"),
  researchTitle:   text("research_title").notNull(),
  signerPosition:  varchar("signer_position", { length: 100 }).notNull(),
  introLetterNumber: varchar("intro_letter_number", { length: 64 }).notNull(),
  introLetterDate:   timestamp("intro_letter_date").notNull(),
  issuedLetterNumber: varchar("issued_letter_number", { length: 100 }),
  issuedLetterDate:   timestamp("issued_letter_date"),
  recipientName:      text("recipient_name"),
  recipientCity:      varchar("recipient_city", { length: 100 }),
  fileIdentity:    text("file_identity"),
  fileIntroLetter: text("file_intro_letter"),
  fileProposal:    text("file_proposal"),
  fileSocialMedia: text("file_social_media"),
  fileSurvey:      text("file_survey"),
  agreementFinalReport: boolean("agreement_final_report").notNull().default(false),
  isSurvei:        boolean("is_survei").notNull().default(false),
  isSendData:      boolean("is_send_data").notNull().default(false),
  status:          varchar("status", { length: 30 }).notNull().default("submitted"),
  reviewNote:      text("review_note"),
  processedBy:     varchar("processed_by", { length: 36 }).references(() => users.id),
  deletedAt:       timestamp("deleted_at"),
  createdAt:       timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:       timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertResearchPermitSchema = createInsertSchema(researchPermitRequests).omit({
  id: true, requestNumber: true, status: true, reviewNote: true,
  processedBy: true, deletedAt: true, createdAt: true, updatedAt: true, isSendData: true,
});
export type InsertResearchPermit = z.infer<typeof insertResearchPermitSchema>;
export type ResearchPermit = typeof researchPermitRequests.$inferSelect;

export const permitStatusHistories = mysqlTable("permit_status_histories", {
  id:         varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  permitId:   varchar("permit_id", { length: 36 }).notNull().references(() => researchPermitRequests.id),
  fromStatus: varchar("from_status", { length: 30 }),
  toStatus:   varchar("to_status", { length: 30 }).notNull(),
  note:       text("note"),
  changedBy:  varchar("changed_by", { length: 36 }).references(() => users.id),
  createdAt:  timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Letter Templates & Generated Letters ─────────────────────────────────────
export const templateCategoryValues = ["surat_izin", "rekomendasi"] as const;

export const letterTemplates = mysqlTable("letter_templates", {
  id:               varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:             text("name").notNull(),
  type:             text("type"),
  category:         varchar("category", { length: 30 }).notNull().default("surat_izin"),
  content:          text("content"),
  placeholders:     text("placeholders"),
  isActive:         boolean("is_active").notNull().default(true),
  officialName:     text("official_name"),
  officialPosition: text("official_position"),
  officialNip:      text("official_nip"),
  city:             text("city"),
  tembusan:         text("tembusan"),
  kepada:           text("kepada"),
  deletedAt:        timestamp("deleted_at"),
  createdBy:        varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy:        varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt:        timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:        timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const generatedLetters = mysqlTable("generated_letters", {
  id:           varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  permitId:     varchar("permit_id", { length: 36 }).notNull().references(() => researchPermitRequests.id),
  templateId:   varchar("template_id", { length: 36 }).references(() => letterTemplates.id),
  fileUrl:      text("file_url"),
  pdfFileUrl:   text("pdf_file_url"),
  letterNumber: text("letter_number"),
  letterDate:   timestamp("letter_date"),
  dataSnapshot: text("data_snapshot"),
  generatedBy:  varchar("generated_by", { length: 36 }).references(() => users.id),
  generatedAt:  timestamp("generated_at"),
  sentAt:       timestamp("sent_at"),
  sentToEmail:  text("sent_to_email"),
  sendError:    text("send_error"),
  deletedAt:    timestamp("deleted_at"),
  createdAt:    timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const letterTemplateFiles = mysqlTable("letter_template_files", {
  id:         varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  templateId: varchar("template_id", { length: 36 }).notNull().references(() => letterTemplates.id),
  fileUrl:    text("file_url").notNull(),
  filePath:   text("file_path").notNull(),
  fileName:   varchar("file_name", { length: 191 }).notNull(),
  mimeType:   varchar("mime_type", { length: 100 }),
  fileSize:   int("file_size"),
  deletedAt:  timestamp("deleted_at"),
  createdAt:  timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Final Reports ────────────────────────────────────────────────────────────
export const finalReports = mysqlTable("final_reports", {
  id:              varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:            text("name"),
  email:           text("email"),
  researchTitle:   text("research_title"),
  permitRequestId: varchar("permit_request_id", { length: 36 }).references(() => researchPermitRequests.id),
  fileUrl:         text("file_url"),
  suggestion:      text("suggestion"),
  deletedAt:       timestamp("deleted_at"),
  createdAt:       timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type FinalReport = typeof finalReports.$inferSelect;
export type InsertFinalReport = typeof finalReports.$inferInsert;

// ─── Suggestion Box ───────────────────────────────────────────────────────────
export const suggestionBox = mysqlTable("suggestion_box", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  name:      text("name"),
  email:     text("email"),
  message:   text("message").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertSuggestionSchema = createInsertSchema(suggestionBox).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestionBox.$inferSelect;

// ─── Surveys ──────────────────────────────────────────────────────────────────
export const surveys = mysqlTable("surveys", {
  id:            varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  respondentName: text("respondent_name"),
  age:           int("age"),
  gender:        varchar("gender", { length: 20 }),
  education:     text("education"),
  occupation:    text("occupation"),
  q1:            int("q1"),
  q2:            int("q2"),
  q3:            int("q3"),
  q4:            int("q4"),
  q5:            int("q5"),
  q6:            int("q6"),
  q7:            int("q7"),
  q8:            int("q8"),
  q9:            int("q9"),
  suggestion:    text("suggestion"),
  deletedAt:     timestamp("deleted_at"),
  createdAt:     timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveys.$inferSelect;

// ─── PPID ────────────────────────────────────────────────────────────────────
export const ppidObjections = mysqlTable("ppid_objections", {
  id:               varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:           varchar("user_id", { length: 36 }).references(() => users.id),
  requestCode:      varchar("request_code", { length: 50 }),
  fullName:         text("full_name").notNull(),
  nik:              varchar("nik", { length: 20 }).notNull(),
  address:          text("address"),
  phone:            varchar("phone", { length: 32 }).notNull(),
  email:            varchar("email", { length: 191 }),
  occupation:       varchar("occupation", { length: 191 }),
  ktpFileUrl:       text("ktp_file_url"),
  informationDetail: text("information_detail"),
  requestPurpose:   text("request_purpose"),
  objectionReasons: json("objection_reasons").$type<string[]>(),
  objectionNote:    text("objection_note"),
  evidenceFileUrl:  text("evidence_file_url"),
  status:           text("status").notNull().default("pending"),
  reviewNote:       text("review_note"),
  processedBy:      varchar("processed_by", { length: 36 }).references(() => users.id),
  processedAt:      timestamp("processed_at"),
  deletedAt:        timestamp("deleted_at"),
  createdAt:        timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:        timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertPpidObjectionSchema = createInsertSchema(ppidObjections).omit({
  id: true, status: true, reviewNote: true, processedBy: true, processedAt: true, createdAt: true, updatedAt: true, deletedAt: true,
});
export type InsertPpidObjection = z.infer<typeof insertPpidObjectionSchema>;
export type PpidObjection = typeof ppidObjections.$inferSelect;

export const ppidInformationRequests = mysqlTable("ppid_information_requests", {
  id:                varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:            varchar("user_id", { length: 36 }).references(() => users.id),
  token:             varchar("token", { length: 16 }),
  fullName:          text("full_name").notNull(),
  nik:               varchar("nik", { length: 20 }).notNull(),
  address:           text("address"),
  phone:             varchar("phone", { length: 32 }).notNull(),
  email:             varchar("email", { length: 191 }),
  occupation:        varchar("occupation", { length: 191 }),
  ktpFileUrl:        text("ktp_file_url"),
  informationDetail: text("information_detail").notNull(),
  requestPurpose:    text("request_purpose").notNull(),
  retrievalMethod:   varchar("retrieval_method", { length: 50 }),
  status:            text("status").notNull().default("pending"),
  reviewNote:        text("review_note"),
  responseFileUrl:   text("response_file_url"),
  processedBy:       varchar("processed_by", { length: 36 }).references(() => users.id),
  processedAt:       timestamp("processed_at"),
  deletedAt:         timestamp("deleted_at"),
  createdAt:         timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:         timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertPpidInfoRequestSchema = createInsertSchema(ppidInformationRequests).omit({
  id: true, status: true, reviewNote: true, processedBy: true, processedAt: true, createdAt: true, updatedAt: true, deletedAt: true,
});
export type InsertPpidInfoRequest = z.infer<typeof insertPpidInfoRequestSchema>;
export type PpidInfoRequest = typeof ppidInformationRequests.$inferSelect;

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:    varchar("user_id", { length: 36 }).references(() => users.id),
  action:    text("action").notNull(),
  entity:    text("entity").notNull(),
  entityId:  text("entity_id"),
  meta:      text("meta"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationTypeValues = [
  "new_permit", "new_info_request", "new_objection", "new_final_report", "permit_status", "new_survey",
] as const;

export const notifications = mysqlTable("notifications", {
  id:           varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  type:         varchar("type", { length: 50 }).notNull(),
  title:        varchar("title", { length: 255 }).notNull(),
  message:      text("message").notNull(),
  resourceId:   varchar("resource_id", { length: 36 }),
  resourceType: varchar("resource_type", { length: 50 }),
  targetRole:   varchar("target_role", { length: 50 }).notNull().default("all"),
  isRead:       boolean("is_read").notNull().default(false),
  readBy:       text("read_by"),
  targetUserId: text("target_user_id"),
  deletedAt:    timestamp("deleted_at"),
  createdAt:    timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export type Notification = typeof notifications.$inferSelect;

// ─── FCM Push Notification Tokens ────────────────────────────────────────────
export const fcmTokens = mysqlTable("fcm_tokens", {
  id:          varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:      varchar("user_id", { length: 36 }).notNull(),
  token:       text("token").notNull(),
  deviceType:  varchar("device_type", { length: 20 }).default("web"),
  platform:    varchar("platform", { length: 20 }).default("admin"),
  createdAt:   timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt:   timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export type FcmToken = typeof fcmTokens.$inferSelect;
export type InsertFcmToken = typeof fcmTokens.$inferInsert;

export const refreshTokens = mysqlTable("refresh_tokens", {
  id:        varchar("id", { length: 36 }).primaryKey().default(uuidDefault),
  userId:    varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked:   boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
