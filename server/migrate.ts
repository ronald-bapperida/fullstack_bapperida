import mysql from "mysql2/promise";

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
  let pool: mysql.Pool | null = null;
  try {
    pool = mysql.createPool(process.env.DATABASE_URL as string);
    for (const sql of MIGRATIONS) {
      try {
        await pool.query(sql);
        console.log("[migrate] OK:", sql.slice(0, 60));
      } catch (err: any) {
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
          // already exists, skip
        } else {
          console.warn("[migrate] WARN:", err.message, "| SQL:", sql.slice(0, 80));
        }
      }
    }
    console.log("[migrate] All migrations applied.");
  } finally {
    if (pool) await pool.end();
  }
}
