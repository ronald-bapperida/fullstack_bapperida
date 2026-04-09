import { defineConfig } from "drizzle-kit";

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (!mysqlUrl) {
  throw new Error("MYSQL_URL (or DATABASE_URL) is missing, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: mysqlUrl,
  },
});
