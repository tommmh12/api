import { dbPool } from "../infrastructure/database/connection.js";

async function addFirstLoginColumn() {
  try {
    console.log("✅ Database pool created");
    console.log("🔧 Adding 'first_login' column to users table...");

    await dbPool.query(`
      ALTER TABLE users
      ADD COLUMN first_login BOOLEAN DEFAULT TRUE
      AFTER password_hash
    `);

    console.log("✅ Successfully added 'first_login' column!");
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️  Column 'first_login' already exists, skipping...");
    } else {
      console.error("❌ Error adding column:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

addFirstLoginColumn();
