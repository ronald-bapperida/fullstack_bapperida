import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

if (!mysqlUrl) {
  throw new Error("MYSQL_URL (or DATABASE_URL) is missing");
}

const pool = mysql.createPool(mysqlUrl);

export const db = drizzle(pool, { schema, mode: "default" });
