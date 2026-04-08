import "dotenv/config";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const pool = mysql.createPool(process.env.DATABASE_URL);

// Helper function to check if column exists
async function columnExists(connection: mysql.PoolConnection, table: string, column: string): Promise<boolean> {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

// Helper function to check if table exists
async function tableExists(connection: mysql.PoolConnection, table: string): Promise<boolean> {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].count > 0;
}

// Helper function to check if index exists
async function indexExists(connection: mysql.PoolConnection, table: string, indexName: string): Promise<boolean> {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].count > 0;
}

export async function runMigrations() {
  let connection: mysql.PoolConnection | null = null;
  
  try {
    console.log("[migrate] Starting migrations...");
    
    // Get connection
    connection = await pool.getConnection();
    
    // Disable foreign key checks temporarily
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    
    // 1. Add columns to research_permit_requests
    const researchColumns = [
      { name: "research_start_date", type: "TIMESTAMP NULL" },
      { name: "research_end_date", type: "TIMESTAMP NULL" },
      { name: "issued_letter_number", type: "VARCHAR(100) NULL" },
      { name: "issued_letter_date", type: "TIMESTAMP NULL" },
      { name: "recipient_name", type: "TEXT NULL" },
      { name: "recipient_city", type: "VARCHAR(100) NULL" },
      { name: "is_survei", type: "BOOLEAN NOT NULL DEFAULT FALSE" }
    ];
    
    for (const col of researchColumns) {
      const exists = await columnExists(connection, "research_permit_requests", col.name);
      if (!exists) {
        await connection.query(`ALTER TABLE research_permit_requests ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[migrate] Added column: research_permit_requests.${col.name}`);
      } else {
        console.log(`[migrate] Skip (column exists): research_permit_requests.${col.name}`);
      }
    }
    
    // 2. Add column to letter_templates
    const categoryExists = await columnExists(connection, "letter_templates", "category");
    if (!categoryExists) {
      await connection.query(`ALTER TABLE letter_templates ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'surat_izin'`);
      console.log(`[migrate] Added column: letter_templates.category`);
    } else {
      console.log(`[migrate] Skip (column exists): letter_templates.category`);
    }
    
    // 3. Add columns to generated_letters (check each column individually)
    const generatedColumns = [
      { name: "pdf_file_url", type: "TEXT NULL" }
    ];
    
    for (const col of generatedColumns) {
      const exists = await columnExists(connection, "generated_letters", col.name);
      if (!exists) {
        await connection.query(`ALTER TABLE generated_letters ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[migrate] Added column: generated_letters.${col.name}`);
      } else {
        console.log(`[migrate] Skip (column exists): generated_letters.${col.name}`);
      }
    }
    
    // 4. Create notifications table
    const notificationsExists = await tableExists(connection, "notifications");
    if (!notificationsExists) {
      await connection.query(`
        CREATE TABLE notifications (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          resource_id VARCHAR(36),
          resource_type VARCHAR(50),
          target_role VARCHAR(50) NOT NULL DEFAULT 'all',
          target_user_id TEXT,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          read_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`[migrate] Created table: notifications`);
    } else {
      console.log(`[migrate] Skip (table exists): notifications`);
    }
    
    // 5. Create password_reset_otps table
    const passwordResetExists = await tableExists(connection, "password_reset_otps");
    if (!passwordResetExists) {
      await connection.query(`
        CREATE TABLE password_reset_otps (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          otp VARCHAR(6) NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log(`[migrate] Created table: password_reset_otps`);
    } else {
      console.log(`[migrate] Skip (table exists): password_reset_otps`);
    }
    
    // 6. Create refresh_tokens table with correct MySQL syntax
    const refreshTokensExists = await tableExists(connection, "refresh_tokens");
    if (!refreshTokensExists) {
      await connection.query(`
        CREATE TABLE refresh_tokens (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log(`[migrate] Created table: refresh_tokens`);
    } else {
      console.log(`[migrate] Skip (table exists): refresh_tokens`);
    }
    
    // 7. Create indexes for refresh_tokens
    const tokenIndexExists = await indexExists(connection, "refresh_tokens", "idx_refresh_tokens_token");
    if (!tokenIndexExists) {
      await connection.query(`CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token)`);
      console.log(`[migrate] Created index: idx_refresh_tokens_token`);
    } else {
      console.log(`[migrate] Skip (index exists): idx_refresh_tokens_token`);
    }
    
    const userIdIndexExists = await indexExists(connection, "refresh_tokens", "idx_refresh_tokens_user_id");
    if (!userIdIndexExists) {
      await connection.query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
      console.log(`[migrate] Created index: idx_refresh_tokens_user_id`);
    } else {
      console.log(`[migrate] Skip (index exists): idx_refresh_tokens_user_id`);
    }
    
    // 8. Convert enum columns to varchar (if they are still enum)
    const enumConversions = [
      { table: "users", column: "role", type: "VARCHAR(30)", default: "'user'" },
      { table: "news", column: "status", type: "VARCHAR(20)", default: "'draft'" },
      { table: "documents", column: "access_level", type: "VARCHAR(20)", default: "'terbuka'" },
      { table: "documents", column: "status", type: "VARCHAR(20)", default: "'draft'" },
      { table: "research_permit_requests", column: "status", type: "VARCHAR(30)", default: "'submitted'" },
      { table: "research_permit_requests", column: "citizenship", type: "VARCHAR(10)", default: "'WNI'" },
      { table: "permit_status_histories", column: "from_status", type: "VARCHAR(30)", nullable: true },
      { table: "permit_status_histories", column: "to_status", type: "VARCHAR(30)", nullable: false, default: "''" },
      { table: "surveys", column: "gender", type: "VARCHAR(20)", nullable: true },
      { table: "menus", column: "location", type: "VARCHAR(30)", default: "'header'" },
      { table: "menu_items", column: "type", type: "VARCHAR(20)", default: "'route'" },
      { table: "banners", column: "link_type", type: "VARCHAR(20)", default: "'external'" },
      { table: "letter_templates", column: "category", type: "VARCHAR(30)", default: "'surat_izin'" }
    ];
    
    for (const conv of enumConversions) {
      try {
        const [columns] = await connection.query<any[]>(
          `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [conv.table, conv.column]
        );
        
        if (columns.length > 0 && columns[0].COLUMN_TYPE?.startsWith('enum')) {
          let sql = `ALTER TABLE ${conv.table} MODIFY COLUMN ${conv.column} ${conv.type}`;
          
          if (conv.nullable === false) {
            sql += ` NOT NULL`;
          } else if (conv.nullable === true) {
            sql += ` NULL`;
          }
          
          if (conv.default) {
            sql += ` DEFAULT ${conv.default}`;
          } else if (conv.nullable === false && !conv.default) {
            sql += ` NOT NULL`;
          }
          
          await connection.query(sql);
          console.log(`[migrate] Converted enum to varchar: ${conv.table}.${conv.column}`);
        } else if (columns.length > 0) {
          console.log(`[migrate] Skip (already varchar): ${conv.table}.${conv.column}`);
        }
      } catch (error) {
        console.error(`[migrate] Error converting ${conv.table}.${conv.column}:`, error);
        // Continue with next conversion
      }
    }
    
    // 9. Fix news_media.file_name column if needed
    try {
      const [fileColumn] = await connection.query<any[]>(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_media' AND COLUMN_NAME = 'file_name'`
      );
      
      if (fileColumn.length > 0 && fileColumn[0].COLUMN_TYPE !== 'text' && fileColumn[0].COLUMN_TYPE !== 'varchar(191)') {
        await connection.query(`ALTER TABLE news_media MODIFY COLUMN file_name VARCHAR(191) NOT NULL`);
        console.log(`[migrate] Modified column: news_media.file_name to VARCHAR(191)`);
      } else {
        console.log(`[migrate] Skip (file_name already correct): news_media.file_name`);
      }
    } catch (error) {
      console.error(`[migrate] Error modifying news_media.file_name:`, error);
    }
    
    // Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    
    console.log("[migrate] All migrations completed successfully!");
    
  } catch (error) {
    console.error("[migrate] Error during migration:", error);
    if (connection) {
      try {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      } catch (e) {
        console.error("[migrate] Error resetting foreign key checks:", e);
      }
    }
    // Don't throw, just log the error
    console.error("[migrate] Migration failed but continuing...");
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (error) {
        console.error("[migrate] Error releasing connection:", error);
      }
    }
  }
}

// Run migrations with error handling
runMigrations().catch((error) => {
  console.error("[migrate] Fatal error:", error);
  console.error("[migrate] Continuing startup – API endpoints will fail until DB is connected.");
});