import { dbPool } from "../infrastructure/database/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runProjectMembersMigration() {
    console.log("🔄 Running project_members table migration...\n");

    const migrationPath = path.join(
        __dirname,
        "../infrastructure/database/migrations/010_create_project_members.sql"
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

        console.log("✅ Project members migration completed successfully!\n");
        console.log("📋 Created tables:");
        console.log("   - project_members\n");

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

runProjectMembersMigration();
