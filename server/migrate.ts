import "dotenv/config";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const pool = mysql.createPool(process.env.DATABASE_URL);

const MIGRATIONS = [
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS research_start_date TIMESTAMP NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS research_end_date TIMESTAMP NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS issued_letter_number VARCHAR(100) NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS issued_letter_date TIMESTAMP NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS recipient_name TEXT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS recipient_city VARCHAR(100) NULL`,
  `ALTER TABLE letter_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'surat_izin'`,
  `ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL`,
  `ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS pdf_path TEXT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS is_survei BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    resource_id VARCHAR(36),
    resource_type VARCHAR(50),
    target_role VARCHAR(50) NOT NULL DEFAULT 'all',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_otps (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
];

export async function runMigrations() {
  const connection = await pool.getConnection();
  try {
    for (const sql of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log("[migrate] OK:", sql.slice(0, 60));
      } catch (err: any) {
        // MySQL error codes
        // 1060: Duplicate column name
        // 1050: Table already exists
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
          console.log("[migrate] Skip (already exists):", sql.slice(0, 60));
        } else {
          console.warn("[migrate] WARN:", err.message, "| SQL:", sql.slice(0, 80));
        }
      }
    }
    console.log("[migrate] All migrations applied.");
  } finally {
    connection.release();
  }
}