import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

// Buat connection pool untuk MySQL
const pool = mysql.createPool(process.env.DATABASE_URL);

export const db = drizzle(pool, { schema, mode: "default" });

const MIGRATIONS = [
  // Permit: research date fields
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS research_start_date TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS research_end_date TIMESTAMP NULL DEFAULT NULL`,
  // Permit: admin-filled letter fields
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS issued_letter_number VARCHAR(100) NULL DEFAULT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS issued_letter_date TIMESTAMP NULL DEFAULT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS recipient_name TEXT NULL DEFAULT NULL`,
  `ALTER TABLE research_permit_requests ADD COLUMN IF NOT EXISTS recipient_city VARCHAR(100) NULL DEFAULT NULL`,
  // Letter templates: category
  `ALTER TABLE letter_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'surat_izin'`,
  // Generated letters: PDF file URL
  `ALTER TABLE generated_letters ADD COLUMN IF NOT EXISTS pdf_file_url TEXT NULL DEFAULT NULL`,
  // Notifications table
  `CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) NOT NULL DEFAULT (UUID()),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    resource_id VARCHAR(36) NULL DEFAULT NULL,
    resource_type VARCHAR(50) NULL DEFAULT NULL,
    target_role VARCHAR(50) NOT NULL DEFAULT 'all',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_by TEXT NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`,
];

export async function runMigrations() {
  let connection = null;
  try {
    connection = await pool.getConnection();
    for (const sql of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log("[migrate] OK:", sql.slice(0, 60));
      } catch (err: any) {
        // MySQL error codes
        // 1060: duplicate column
        // 1050: duplicate table
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
          // already exists, skip
        } else {
          console.warn("[migrate] WARN:", err.message, "| SQL:", sql.slice(0, 80));
        }
      }
    }
    console.log("[migrate] All migrations applied.");
  } finally {
    if (connection) connection.release();
  }
}