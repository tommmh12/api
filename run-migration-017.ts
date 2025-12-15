import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "nexus_db",
    multipleStatements: true,
  });

  try {
    console.log(
      "🔄 Running migration 017_create_notification_settings.sql...\n"
    );

    const migrationPath = path.join(
      __dirname,
      "src/infrastructure/database/migrations/017_create_notification_settings.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      console.error("❌ Migration file not found:", migrationPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Split by delimiter and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await connection.query(statement);
          console.log("✅ Executed:", statement.substring(0, 60) + "...");
        } catch (err: any) {
          // Ignore "already exists" errors
          if (
            err.code === "ER_TABLE_EXISTS_ERROR" ||
            err.code === "ER_DUP_ENTRY" ||
            err.message.includes("already exists") ||
            err.message.includes("Duplicate")
          ) {
            console.log(
              "⏭️  Skipped (already exists):",
              statement.substring(0, 60) + "..."
            );
          } else {
            console.error("❌ Error:", err.message);
            console.error("   Statement:", statement.substring(0, 100));
          }
        }
      }
    }

    console.log("\n✅ Migration 017 completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
