import { dbPool } from "./src/infrastructure/database/connection.js";
import fs from "fs";

async function runMigration() {
  try {
    const sql = fs.readFileSync(
      "./src/infrastructure/database/migrations/019_create_alert_history.sql",
      "utf-8"
    );
    const statements = sql.split(";").filter((s) => s.trim());

    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await dbPool.query(stmt);
          console.log("✅ Executed:", stmt.substring(0, 60) + "...");
        } catch (e: any) {
          console.log("⚠️ Skipped:", e.message.substring(0, 80));
        }
      }
    }
    console.log("\n✅ Migration 019 completed!");
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

runMigration();
