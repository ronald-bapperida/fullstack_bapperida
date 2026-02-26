CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(36),
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`meta` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`title` text NOT NULL,
	`slug` varchar(191),
	`placement` varchar(50) NOT NULL DEFAULT 'home',
	`image_desktop` text,
	`image_mobile` text,
	`alt_text` varchar(191),
	`link_type` enum('external','page','news') NOT NULL DEFAULT 'external',
	`link_url` text,
	`target` varchar(20) NOT NULL DEFAULT '_self',
	`sort_order` int NOT NULL DEFAULT 0,
	`start_at` timestamp,
	`end_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`view_count` int NOT NULL DEFAULT 0,
	`click_count` int NOT NULL DEFAULT 0,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_categories` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_kinds` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_kinds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_types` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`extension` text,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`title` text NOT NULL,
	`doc_no` text,
	`kind_id` varchar(36),
	`category_id` varchar(36),
	`type_id` varchar(36),
	`publisher` text,
	`content` text,
	`file_url` text,
	`file_path` text,
	`access_level` enum('terbuka','terbatas','rahasia') NOT NULL DEFAULT 'terbuka',
	`published_at` timestamp,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `final_reports` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`email` text NOT NULL,
	`research_title` text NOT NULL,
	`permit_request_id` varchar(36),
	`file_url` text,
	`suggestion` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `final_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_letters` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`permit_id` varchar(36) NOT NULL,
	`template_id` varchar(36),
	`file_url` text,
	`letter_number` text,
	`letter_date` timestamp,
	`data_snapshot` text,
	`generated_by` varchar(36),
	`generated_at` timestamp,
	`sent_at` timestamp,
	`sent_to_email` text,
	`send_error` text,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `generated_letters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letter_templates` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`type` text NOT NULL DEFAULT ('research_permit'),
	`content` text NOT NULL,
	`placeholders` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `letter_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`menu_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`title` text NOT NULL,
	`type` enum('route','url','page','news') NOT NULL DEFAULT 'url',
	`value` text,
	`icon` text,
	`target` text NOT NULL DEFAULT ('_self'),
	`requires_auth` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`location` enum('header','footer','mobile') NOT NULL DEFAULT 'header',
	`is_active` boolean NOT NULL DEFAULT true,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `menus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`title` text NOT NULL,
	`slug` varchar(191) NOT NULL,
	`category_id` varchar(36),
	`content` text NOT NULL,
	`excerpt` text,
	`url` text,
	`featured_image` text,
	`featured_caption` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`event_at` timestamp,
	`published_at` timestamp,
	`author_id` varchar(36),
	`view_count` int NOT NULL DEFAULT 0,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `news_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `news_categories` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`slug` varchar(191) NOT NULL,
	`description` text,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `news_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `news_media` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`news_id` varchar(36) NOT NULL,
	`file_url` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` text NOT NULL,
	`caption` text,
	`is_main` boolean NOT NULL DEFAULT false,
	`type` text NOT NULL DEFAULT ('image'),
	`insert_after_paragraph` int DEFAULT 0,
	`sort_order` int DEFAULT 0,
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `news_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permit_status_histories` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`permit_id` varchar(36) NOT NULL,
	`from_status` enum('submitted','in_review','revision_requested','approved','generated_letter','sent','rejected'),
	`to_status` enum('submitted','in_review','revision_requested','approved','generated_letter','sent','rejected') NOT NULL,
	`note` text,
	`changed_by` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `permit_status_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_sequences` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`year` int NOT NULL,
	`last_seq` int NOT NULL DEFAULT 0,
	CONSTRAINT `request_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_permit_requests` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`request_number` varchar(64) NOT NULL,
	`email` varchar(191) NOT NULL,
	`full_name` text NOT NULL,
	`nim_nik` varchar(32) NOT NULL,
	`birth_place` varchar(100) NOT NULL,
	`work_unit` varchar(191) NOT NULL,
	`institution` varchar(191) NOT NULL,
	`phone_wa` varchar(32) NOT NULL,
	`citizenship` enum('WNI','WNA') NOT NULL DEFAULT 'WNI',
	`research_location` varchar(191) NOT NULL,
	`research_duration` varchar(50) NOT NULL,
	`research_title` text NOT NULL,
	`signer_position` varchar(100) NOT NULL,
	`intro_letter_number` varchar(64) NOT NULL,
	`intro_letter_date` timestamp NOT NULL,
	`file_identity` text,
	`file_intro_letter` text,
	`file_proposal` text,
	`file_social_media` text,
	`file_survey` text,
	`agreement_final_report` boolean NOT NULL DEFAULT false,
	`status` enum('submitted','in_review','revision_requested','approved','generated_letter','sent','rejected') NOT NULL DEFAULT 'submitted',
	`review_note` text,
	`processed_by` varchar(36),
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `research_permit_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_permit_requests_request_number_unique` UNIQUE(`request_number`)
);
--> statement-breakpoint
CREATE TABLE `suggestion_box` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text,
	`email` text,
	`message` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `suggestion_box_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`respondent_name` text NOT NULL,
	`age` int NOT NULL,
	`gender` enum('laki_laki','perempuan') NOT NULL,
	`education` text NOT NULL,
	`occupation` text NOT NULL,
	`q1` int NOT NULL,
	`q2` int NOT NULL,
	`q3` int NOT NULL,
	`q4` int NOT NULL,
	`q5` int NOT NULL,
	`q6` int NOT NULL,
	`q7` int NOT NULL,
	`q8` int NOT NULL,
	`q9` int NOT NULL,
	`suggestion` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `surveys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`username` varchar(64) NOT NULL,
	`email` varchar(191) NOT NULL,
	`password` text NOT NULL,
	`full_name` varchar(191) NOT NULL,
	`role` enum('super_admin','admin_bpp','admin_rida','user') NOT NULL DEFAULT 'user',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_kind_id_document_kinds_id_fk` FOREIGN KEY (`kind_id`) REFERENCES `document_kinds`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_category_id_document_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `document_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_type_id_document_types_id_fk` FOREIGN KEY (`type_id`) REFERENCES `document_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `final_reports` ADD CONSTRAINT `final_reports_permit_request_id_research_permit_requests_id_fk` FOREIGN KEY (`permit_request_id`) REFERENCES `research_permit_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generated_letters` ADD CONSTRAINT `generated_letters_permit_id_research_permit_requests_id_fk` FOREIGN KEY (`permit_id`) REFERENCES `research_permit_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generated_letters` ADD CONSTRAINT `generated_letters_template_id_letter_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `letter_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generated_letters` ADD CONSTRAINT `generated_letters_generated_by_users_id_fk` FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `letter_templates` ADD CONSTRAINT `letter_templates_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `letter_templates` ADD CONSTRAINT `letter_templates_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_menu_id_menus_id_fk` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news` ADD CONSTRAINT `news_category_id_news_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `news_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news` ADD CONSTRAINT `news_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_media` ADD CONSTRAINT `news_media_news_id_news_id_fk` FOREIGN KEY (`news_id`) REFERENCES `news`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `permit_status_histories` ADD CONSTRAINT `permit_status_histories_permit_id_research_permit_requests_id_fk` FOREIGN KEY (`permit_id`) REFERENCES `research_permit_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `permit_status_histories` ADD CONSTRAINT `permit_status_histories_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_permit_requests` ADD CONSTRAINT `research_permit_requests_processed_by_users_id_fk` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;