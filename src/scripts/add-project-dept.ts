import { dbPool } from "../infrastructure/database/connection.js";

async function addDepartmentColumn() {
  try {
    console.log("✅ Database pool created");
    console.log("🔧 Adding 'department_id' column to projects table...");

    await dbPool.query(`
      ALTER TABLE projects
      ADD COLUMN department_id CHAR(36) NULL
      AFTER manager_id,
      ADD INDEX idx_department (department_id)
    `);

    console.log("✅ Successfully added 'department_id' column!");
  } catch (error: any) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️  Column 'department_id' already exists, skipping...");
    } else {
      console.error("❌ Error adding column:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

addDepartmentColumn();
