import { dbPool } from "../infrastructure/database/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runChatMigration() {
  console.log("🔄 Running chat tables migration...\n");

  const migrationPath = path.join(
    __dirname,
    "../infrastructure/database/migrations/008_create_chat_tables.sql"
  );

  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await dbPool.query(statement);
    }

    console.log("✅ Chat tables migration completed successfully!\n");
    console.log("📋 Created tables:");
    console.log("   - conversations");
    console.log("   - chat_messages");
    console.log("   - chat_attachments");
    console.log("   - user_online_status");
    console.log("   - typing_indicators\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runChatMigration();
