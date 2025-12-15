import { dbPool } from "../infrastructure/database/connection.js";

async function addCodeColumn() {
  try {
    console.log("🔧 Adding 'code' column to departments table...");

    await dbPool.query(`
      ALTER TABLE departments 
      ADD COLUMN code VARCHAR(50) NULL UNIQUE AFTER name
    `);

    console.log("✅ Successfully added 'code' column!");
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("⚠️  Column 'code' already exists!");
    } else {
      console.error("❌ Error:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

addCodeColumn();
