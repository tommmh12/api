import { dbPool } from "./src/infrastructure/database/connection.js";

async function runMigration() {
  console.log("🚀 Running migration 020: Extend alert_rules targets...");

  try {
    // Check if columns already exist
    const [columns] = await dbPool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'alert_rules'
    `);

    const existingColumns = (columns as any[]).map((c) => c.COLUMN_NAME);

    if (!existingColumns.includes("notify_departments")) {
      await dbPool.query(`
        ALTER TABLE alert_rules
        ADD COLUMN notify_departments JSON DEFAULT NULL COMMENT 'Danh sách ID phòng ban nhận cảnh báo'
      `);
      console.log("✅ Added notify_departments column");
    } else {
      console.log("⏭️ notify_departments column already exists");
    }

    if (!existingColumns.includes("notify_users")) {
      await dbPool.query(`
        ALTER TABLE alert_rules
        ADD COLUMN notify_users JSON DEFAULT NULL COMMENT 'Danh sách ID người dùng cụ thể nhận cảnh báo'
      `);
      console.log("✅ Added notify_users column");
    } else {
      console.log("⏭️ notify_users column already exists");
    }

    if (!existingColumns.includes("created_by")) {
      await dbPool.query(`
        ALTER TABLE alert_rules
        ADD COLUMN created_by CHAR(36) DEFAULT NULL COMMENT 'Admin tạo rule này'
      `);
      console.log("✅ Added created_by column");

      // Add foreign key
      try {
        await dbPool.query(`
          ALTER TABLE alert_rules
          ADD CONSTRAINT fk_alert_rules_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log("✅ Added foreign key constraint");
      } catch (err: any) {
        if (!err.message.includes("Duplicate")) {
          console.log("⚠️ Could not add foreign key:", err.message);
        }
      }
    } else {
      console.log("⏭️ created_by column already exists");
    }

    console.log("✅ Migration 020 completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

runMigration();
