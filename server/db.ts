// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";
// import * as schema from "@shared/schema";

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// export const db = drizzle(pool, { schema });

// If you are still getting "DATABASE_URL is missing", ensure that:
// 1. You have installed the `dotenv` package (`npm install dotenv`).
// 2. At the top of your entry point (e.g., server/index.ts or script/build.ts), add:
//      import "dotenv/config"
//    OR separately:
//      import dotenv from "dotenv";
//      dotenv.config();
// 3. Your .env file is at the project root and contains a line like:
//      DATABASE_URL="mysql://root:simple159@127.0.0.1:3306/bapperida_db"
// 4. Restart your dev process after making changes.
//
// This will ensure `process.env.DATABASE_URL` is properly loaded and available here.


import "dotenv/config"
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const pool = mysql.createPool(process.env.DATABASE_URL);

export const db = drizzle(pool, { schema, mode: "default" });