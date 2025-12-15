import { dbPool } from "../infrastructure/database/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
    console.log("Running migration 011...");
    try {
        const sqlPath = path.join(__dirname, "../infrastructure/database/migrations/011_update_tasks_and_projects.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");

        // Split by semicolon, but be careful with delimiters. 
        // Simple split might work for this specific file.
        const statements = sql.split(';').filter(s => s.trim().length > 0);

        const connection = await dbPool.getConnection();
        try {
            for (const statement of statements) {
                if (statement.trim().toUpperCase().startsWith("USE ")) continue; // Skip USE
                await connection.query(statement);
            }
            console.log("Migration 011 completed successfully.");
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit();
    }
};

main();
