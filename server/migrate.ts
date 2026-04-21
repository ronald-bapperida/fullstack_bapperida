import { logger } from "./logger";
import "dotenv/config";
import mysql from "mysql2/promise";

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (!mysqlUrl) {
  throw new Error("MYSQL_URL (or DATABASE_URL) is missing");
}

const pool = mysql.createPool(mysqlUrl);

async function columnExists(conn: mysql.PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as count FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return parseInt((rows as any)[0].count) > 0;
}

async function tableExists(conn: mysql.PoolConnection, table: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return parseInt((rows as any)[0].count) > 0;
}

async function indexExists(conn: mysql.PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as count FROM information_schema.statistics 
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  return parseInt((rows as any)[0].count) > 0;
}

export async function runMigrations() {
  const conn = await pool.getConnection();

  try {
    logger.log("[migrate] Starting migrations...");

    // Create all tables if they don't exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        username VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(191) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password TEXT NOT NULL,
        full_name VARCHAR(191) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'user',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        verified TINYINT(1) NOT NULL DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS news_categories (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        slug VARCHAR(191) NOT NULL UNIQUE,
        description TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS news (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title TEXT NOT NULL,
        slug VARCHAR(191) NOT NULL UNIQUE,
        category_id VARCHAR(36),
        content TEXT NOT NULL,
        excerpt TEXT,
        url TEXT,
        featured_image TEXT,
        featured_caption TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        event_at TIMESTAMP NULL,
        published_at TIMESTAMP NULL,
        author_id VARCHAR(36),
        view_count INT NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES news_categories(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS news_media (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        news_id VARCHAR(36) NOT NULL,
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INT NOT NULL,
        mime_type TEXT NOT NULL,
        caption TEXT,
        is_main TINYINT(1) NOT NULL DEFAULT 0,
        type VARCHAR(20) NOT NULL DEFAULT 'image',
        insert_after_paragraph INT DEFAULT 0,
        sort_order INT DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title TEXT NOT NULL,
        slug VARCHAR(191),
        placement VARCHAR(50) NOT NULL DEFAULT 'home',
        image_desktop TEXT,
        image_mobile TEXT,
        alt_text VARCHAR(191),
        link_type VARCHAR(20) NOT NULL DEFAULT 'external',
        link_url TEXT,
        target VARCHAR(20) NOT NULL DEFAULT '_self',
        sort_order INT NOT NULL DEFAULT 0,
        start_at TIMESTAMP NULL,
        end_at TIMESTAMP NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        view_count INT NOT NULL DEFAULT 0,
        click_count INT NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        location VARCHAR(30) NOT NULL DEFAULT 'header',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        menu_id VARCHAR(36) NOT NULL,
        parent_id VARCHAR(36),
        title TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'route',
        value TEXT,
        icon TEXT,
        target TEXT,
        requires_auth TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_id) REFERENCES menus(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        level INT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_kinds (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        extension TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        document_id VARCHAR(36) NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title TEXT NOT NULL,
        doc_no TEXT,
        kind_id VARCHAR(36),
        category_id VARCHAR(36),
        type_id VARCHAR(36),
        publisher TEXT,
        content TEXT,
        file_url TEXT,
        file_path TEXT,
        downloaded_count INT NOT NULL DEFAULT 0,
        access_level VARCHAR(20) NOT NULL DEFAULT 'terbuka',
        published_at TIMESTAMP NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (kind_id) REFERENCES document_kinds(id),
        FOREIGN KEY (category_id) REFERENCES document_categories(id),
        FOREIGN KEY (type_id) REFERENCES document_types(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS request_sequences (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        year INT NOT NULL,
        last_seq INT NOT NULL DEFAULT 0
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS research_permit_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        request_number VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(191) NOT NULL,
        full_name TEXT NOT NULL,
        nim_nik VARCHAR(32) NOT NULL,
        birth_place VARCHAR(100) NOT NULL,
        work_unit VARCHAR(191) NOT NULL,
        institution VARCHAR(191) NOT NULL,
        phone_wa VARCHAR(32) NOT NULL,
        citizenship VARCHAR(10) NOT NULL DEFAULT 'WNI',
        research_location VARCHAR(191) NOT NULL,
        research_duration VARCHAR(50) NOT NULL,
        research_start_date TIMESTAMP NULL,
        research_end_date TIMESTAMP NULL,
        research_title TEXT NOT NULL,
        signer_position VARCHAR(100) NOT NULL,
        intro_letter_number VARCHAR(64) NOT NULL,
        intro_letter_date TIMESTAMP NOT NULL,
        issued_letter_number VARCHAR(100),
        issued_letter_date TIMESTAMP NULL,
        recipient_name TEXT,
        recipient_city VARCHAR(100),
        file_identity TEXT,
        file_intro_letter TEXT,
        file_proposal TEXT,
        file_social_media TEXT,
        file_survey TEXT,
        agreement_final_report TINYINT(1) NOT NULL DEFAULT 0,
        is_survei TINYINT(1) NOT NULL DEFAULT 0,
        is_send_data TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'submitted',
        review_note TEXT,
        processed_by VARCHAR(36),
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (processed_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permit_status_histories (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        permit_id VARCHAR(36) NOT NULL,
        from_status VARCHAR(30),
        to_status VARCHAR(30) NOT NULL,
        note TEXT,
        changed_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (permit_id) REFERENCES research_permit_requests(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS letter_templates (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT NOT NULL,
        type TEXT,
        category VARCHAR(30) NOT NULL DEFAULT 'surat_izin',
        content TEXT,
        placeholders TEXT,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        official_name TEXT,
        official_position TEXT,
        official_nip TEXT,
        city TEXT,
        tembusan TEXT,
        kepada TEXT,
        deleted_at TIMESTAMP NULL,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS generated_letters (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        permit_id VARCHAR(36) NOT NULL,
        template_id VARCHAR(36),
        file_url TEXT,
        pdf_file_url TEXT,
        letter_number TEXT,
        letter_date TIMESTAMP NULL,
        data_snapshot TEXT,
        generated_by VARCHAR(36),
        generated_at TIMESTAMP NULL,
        sent_at TIMESTAMP NULL,
        sent_to_email TEXT,
        send_error TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (permit_id) REFERENCES research_permit_requests(id),
        FOREIGN KEY (template_id) REFERENCES letter_templates(id),
        FOREIGN KEY (generated_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS letter_template_files (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        template_id VARCHAR(36) NOT NULL,
        file_url TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(191) NOT NULL,
        mime_type VARCHAR(100),
        file_size INT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES letter_templates(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS final_reports (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT,
        email TEXT,
        research_title TEXT,
        permit_request_id VARCHAR(36),
        file_url TEXT,
        suggestion TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (permit_request_id) REFERENCES research_permit_requests(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS suggestion_box (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name TEXT,
        email TEXT,
        message TEXT NOT NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        respondent_name TEXT,
        age INT,
        gender VARCHAR(20),
        education TEXT,
        occupation TEXT,
        q1 INT,
        q2 INT,
        q3 INT,
        q4 INT,
        q5 INT,
        q6 INT,
        q7 INT,
        q8 INT,
        q9 INT,
        suggestion TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ppid_objections (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        request_code VARCHAR(50),
        full_name TEXT NOT NULL,
        nik VARCHAR(20) NOT NULL,
        address TEXT,
        phone VARCHAR(32) NOT NULL,
        email VARCHAR(191),
        occupation VARCHAR(191),
        ktp_file_url TEXT,
        information_detail TEXT,
        request_purpose TEXT,
        objection_reasons JSON,
        objection_note TEXT,
        evidence_file_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        review_note TEXT,
        processed_by VARCHAR(36),
        processed_at TIMESTAMP NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (processed_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ppid_information_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        token VARCHAR(16),
        full_name TEXT NOT NULL,
        nik VARCHAR(20) NOT NULL,
        address TEXT,
        phone VARCHAR(32) NOT NULL,
        email VARCHAR(191),
        occupation VARCHAR(191),
        ktp_file_url TEXT,
        information_detail TEXT NOT NULL,
        request_purpose TEXT NOT NULL,
        retrieval_method VARCHAR(50),
        status TEXT NOT NULL DEFAULT 'pending',
        review_note TEXT,
        response_file_url TEXT,
        processed_by VARCHAR(36),
        processed_at TIMESTAMP NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (processed_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36),
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        resource_id VARCHAR(36),
        resource_type VARCHAR(50),
        target_role VARCHAR(50) NOT NULL DEFAULT 'all',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_by TEXT,
        target_user_id TEXT,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── ALTER TABLE: add new columns to existing tables ──────────────────────
    const alterations: Array<{ table: string; column: string; sql: string }> = [
      { table: "users", column: "deleted_at", sql: "ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "letter_templates", column: "deleted_at", sql: "ALTER TABLE letter_templates ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "letter_template_files", column: "deleted_at", sql: "ALTER TABLE letter_template_files ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "final_reports", column: "deleted_at", sql: "ALTER TABLE final_reports ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "suggestion_box", column: "deleted_at", sql: "ALTER TABLE suggestion_box ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "surveys", column: "deleted_at", sql: "ALTER TABLE surveys ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "ppid_objections", column: "deleted_at", sql: "ALTER TABLE ppid_objections ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "ppid_information_requests", column: "deleted_at", sql: "ALTER TABLE ppid_information_requests ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "notifications", column: "deleted_at", sql: "ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP NULL" },
      { table: "research_permit_requests", column: "is_send_data", sql: "ALTER TABLE research_permit_requests ADD COLUMN is_send_data TINYINT(1) NOT NULL DEFAULT 0" },
    ];

    for (const alt of alterations) {
      const exists = await columnExists(conn, alt.table, alt.column);
      if (!exists) {
        await conn.query(alt.sql);
        logger.log(`[migrate] Added column ${alt.column} to ${alt.table}`);
      }
    }

    // ─── Upgrade menu_items.value from TEXT to LONGTEXT ───────────────────
    {
      const [rows] = await conn.query(
        `SELECT DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'value'`
      ) as any;
      const colType: string = rows?.[0]?.DATA_TYPE?.toLowerCase() || "";
      if (colType === "text") {
        await conn.query(`ALTER TABLE menu_items MODIFY COLUMN value LONGTEXT`);
        logger.log("[migrate] Upgraded menu_items.value from TEXT to LONGTEXT");
      }
    }

    // ─── FCM Tokens table ─────────────────────────────────────────────────
    const hasFcmTokensTable = await tableExists(conn, "fcm_tokens");
    if (!hasFcmTokensTable) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS fcm_tokens (
          id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          token TEXT NOT NULL,
          device_type VARCHAR(20) DEFAULT 'web',
          platform VARCHAR(20) DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_fcm_tokens_user_id (user_id),
          UNIQUE KEY uq_fcm_user_platform (user_id, platform(191))
        )
      `);
      logger.log("[migrate] Created table: fcm_tokens");
    }

    // Create indexes
    const indexes = [
      { table: "refresh_tokens", name: "idx_refresh_tokens_token", sql: "CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token)" },
      { table: "refresh_tokens", name: "idx_refresh_tokens_user_id", sql: "CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)" },
    ];

    for (const idx of indexes) {
      const exists = await indexExists(conn, idx.table, idx.name);
      if (!exists) {
        await conn.query(idx.sql);
        logger.log(`[migrate] Created index: ${idx.name}`);
      }
    }

    logger.log("[migrate] All migrations completed successfully!");

  } catch (error) {
    logger.error("[migrate] Error during migration:", error);
    logger.error("[migrate] Migration failed but continuing...");
  } finally {
    conn.release();
  }
}

runMigrations().catch((error) => {
  logger.error("[migrate] Fatal error:", error);
  logger.error("[migrate] Continuing startup – API endpoints will fail until DB is connected.");
});
