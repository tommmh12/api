import { dbPool } from "./src/infrastructure/database/connection.js";

async function createTable() {
  console.log("🔧 Tạo bảng news_department_access...");

  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS news_department_access (
        id VARCHAR(36) PRIMARY KEY,
        department_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_dept (department_id),
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Đã tạo bảng news_department_access");
  } catch (error: any) {
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("ℹ️ Bảng đã tồn tại");
    } else {
      console.error("❌ Lỗi:", error.message);
    }
  } finally {
    await dbPool.end();
    process.exit(0);
  }
}

createTable();
