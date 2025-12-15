import { dbPool } from "../infrastructure/database/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log("🚀 Starting group chat migration...");

    const migrationPath = path.join(
      __dirname,
      "../infrastructure/database/migrations/009_create_group_chat_tables.sql"
    );

    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Split by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await dbPool.execute(statement);
    }

    console.log("✅ Group chat migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
