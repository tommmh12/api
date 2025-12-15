import { createConnection } from "./connection.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let connection;
  try {
    console.log("🔄 Starting migration 008: Add Moderation and Tracking...");
    
    connection = await createConnection();
    
    // Read migration file
    const migrationPath = path.join(__dirname, "migrations", "008_add_content_moderation_tracking.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    
    // Remove comments and USE statements, then split by semicolons
    const cleanedSql = sql
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith("--") && !trimmed.startsWith("USE");
      })
      .join("\n");
    
    // Split by semicolons, but keep multi-line statements together
    const statements = cleanedSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length > 10); // Filter out very short fragments
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    console.log(`\nFirst statement preview: ${statements[0]?.substring(0, 100)}...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;
      
      try {
        const statementPreview = statement.substring(0, 80).replace(/\n/g, " ");
        console.log(`\n[${i + 1}/${statements.length}] Executing: ${statementPreview}...`);
        await connection.query(statement + ";");
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Check if it's a "duplicate column" or "table already exists" error
        if (
          error.message.includes("Duplicate column name") ||
          error.message.includes("already exists") ||
          error.message.includes("Duplicate key name") ||
          error.message.includes("Duplicate column") ||
          error.code === "ER_DUP_FIELDNAME" ||
          error.code === "ER_TABLE_EXISTS_ERROR" ||
          error.code === "ER_DUP_KEYNAME"
        ) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message.split("\n")[0]}`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          console.error(`Statement was: ${statement.substring(0, 200)}`);
          throw error;
        }
      }
    }
    
    console.log("\n✅ Migration 008 completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

runMigration();

