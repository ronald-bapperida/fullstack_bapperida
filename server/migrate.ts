import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function columnExists(client: any, table: string, column: string): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(*) as count FROM information_schema.columns 
     WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return parseInt(result.rows[0].count) > 0;
}

async function tableExists(client: any, table: string): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_name = $1`,
    [table]
  );
  return parseInt(result.rows[0].count) > 0;
}

async function indexExists(client: any, indexName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = $1`,
    [indexName]
  );
  return parseInt(result.rows[0].count) > 0;
}

export async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log("[migrate] Starting migrations...");

    // Ensure pgcrypto extension for gen_random_uuid()
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    } catch (e: any) {
      // Ignore if already exists
      if (!e.message?.includes("already exists")) throw e;
    }

    // Create all tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        username VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(191) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password TEXT NOT NULL,
        full_name VARCHAR(191) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        otp VARCHAR(6) NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS news_categories (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        slug VARCHAR(191) NOT NULL UNIQUE,
        description TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        slug VARCHAR(191) NOT NULL UNIQUE,
        category_id VARCHAR(36) REFERENCES news_categories(id),
        content TEXT NOT NULL,
        excerpt TEXT,
        url TEXT,
        featured_image TEXT,
        featured_caption TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        event_at TIMESTAMP,
        published_at TIMESTAMP,
        author_id VARCHAR(36) REFERENCES users(id),
        view_count INTEGER NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS news_media (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        news_id VARCHAR(36) NOT NULL REFERENCES news(id),
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        caption TEXT,
        is_main BOOLEAN NOT NULL DEFAULT FALSE,
        type TEXT NOT NULL DEFAULT 'image',
        insert_after_paragraph INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        slug VARCHAR(191),
        placement VARCHAR(50) NOT NULL DEFAULT 'home',
        image_desktop TEXT,
        image_mobile TEXT,
        alt_text VARCHAR(191),
        link_type VARCHAR(20) NOT NULL DEFAULT 'external',
        link_url TEXT,
        target VARCHAR(20) NOT NULL DEFAULT '_self',
        sort_order INTEGER NOT NULL DEFAULT 0,
        start_at TIMESTAMP,
        end_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        view_count INTEGER NOT NULL DEFAULT 0,
        click_count INTEGER NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        location VARCHAR(30) NOT NULL DEFAULT 'header',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        menu_id VARCHAR(36) NOT NULL REFERENCES menus(id),
        parent_id VARCHAR(36),
        title TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'route',
        value TEXT,
        icon TEXT,
        target TEXT,
        requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        level INTEGER,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_kinds (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        extension TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        document_id VARCHAR(36) NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        doc_no TEXT,
        kind_id VARCHAR(36) REFERENCES document_kinds(id),
        category_id VARCHAR(36) REFERENCES document_categories(id),
        type_id VARCHAR(36) REFERENCES document_types(id),
        publisher TEXT,
        content TEXT,
        file_url TEXT,
        file_path TEXT,
        downloaded_count INTEGER NOT NULL DEFAULT 0,
        access_level VARCHAR(20) NOT NULL DEFAULT 'terbuka',
        published_at TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS request_sequences (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        year INTEGER NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS research_permit_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        research_start_date TIMESTAMP,
        research_end_date TIMESTAMP,
        research_title TEXT NOT NULL,
        signer_position VARCHAR(100) NOT NULL,
        intro_letter_number VARCHAR(64) NOT NULL,
        intro_letter_date TIMESTAMP NOT NULL,
        issued_letter_number VARCHAR(100),
        issued_letter_date TIMESTAMP,
        recipient_name TEXT,
        recipient_city VARCHAR(100),
        file_identity TEXT,
        file_intro_letter TEXT,
        file_proposal TEXT,
        file_social_media TEXT,
        file_survey TEXT,
        agreement_final_report BOOLEAN NOT NULL DEFAULT FALSE,
        is_survei BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(30) NOT NULL DEFAULT 'submitted',
        review_note TEXT,
        processed_by VARCHAR(36) REFERENCES users(id),
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS permit_status_histories (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        permit_id VARCHAR(36) NOT NULL REFERENCES research_permit_requests(id),
        from_status VARCHAR(30),
        to_status VARCHAR(30) NOT NULL,
        note TEXT,
        changed_by VARCHAR(36) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_templates (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        type TEXT,
        category VARCHAR(30) NOT NULL DEFAULT 'surat_izin',
        content TEXT,
        placeholders TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        official_name TEXT,
        official_position TEXT,
        official_nip TEXT,
        city TEXT,
        tembusan TEXT,
        kepada TEXT,
        created_by VARCHAR(36) REFERENCES users(id),
        updated_by VARCHAR(36) REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_letters (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        permit_id VARCHAR(36) NOT NULL REFERENCES research_permit_requests(id),
        template_id VARCHAR(36) REFERENCES letter_templates(id),
        file_url TEXT,
        pdf_file_url TEXT,
        letter_number TEXT,
        letter_date TIMESTAMP,
        data_snapshot TEXT,
        generated_by VARCHAR(36) REFERENCES users(id),
        generated_at TIMESTAMP,
        sent_at TIMESTAMP,
        sent_to_email TEXT,
        send_error TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_template_files (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        template_id VARCHAR(36) NOT NULL REFERENCES letter_templates(id),
        file_url TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(191) NOT NULL,
        mime_type VARCHAR(100),
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS final_reports (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT,
        email TEXT,
        research_title TEXT,
        permit_request_id VARCHAR(36) REFERENCES research_permit_requests(id),
        file_url TEXT,
        suggestion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suggestion_box (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT,
        email TEXT,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        respondent_name TEXT,
        age INTEGER,
        gender VARCHAR(20),
        education TEXT,
        occupation TEXT,
        q1 INTEGER,
        q2 INTEGER,
        q3 INTEGER,
        q4 INTEGER,
        q5 INTEGER,
        q6 INTEGER,
        q7 INTEGER,
        q8 INTEGER,
        q9 INTEGER,
        suggestion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ppid_objections (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        objection_reasons JSONB,
        objection_note TEXT,
        evidence_file_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        review_note TEXT,
        processed_by VARCHAR(36) REFERENCES users(id),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ppid_information_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        processed_by VARCHAR(36) REFERENCES users(id),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(36) REFERENCES users(id),
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        resource_id VARCHAR(36),
        resource_type VARCHAR(50),
        target_role VARCHAR(50) NOT NULL DEFAULT 'all',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_by TEXT,
        target_user_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    const indexes = [
      { name: "idx_refresh_tokens_token", sql: "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)" },
      { name: "idx_refresh_tokens_user_id", sql: "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)" },
    ];

    for (const idx of indexes) {
      await client.query(idx.sql);
      console.log(`[migrate] Ensured index: ${idx.name}`);
    }

    console.log("[migrate] All migrations completed successfully!");

  } catch (error) {
    console.error("[migrate] Error during migration:", error);
    console.error("[migrate] Migration failed but continuing...");
  } finally {
    client.release();
  }
}

runMigrations().catch((error) => {
  console.error("[migrate] Fatal error:", error);
  console.error("[migrate] Continuing startup – API endpoints will fail until DB is connected.");
});
