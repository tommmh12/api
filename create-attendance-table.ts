import { dbPool } from "../src/infrastructure/database/connection.js";

async function createAttendanceTable() {
  console.log("🚀 Creating attendance table...");

  try {
    const query = `
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(36) PRIMARY KEY,
        employee_id VARCHAR(36) NOT NULL,
        date DATE NOT NULL,
        check_in TIMESTAMP NULL,
        check_out TIMESTAMP NULL,
        status ENUM('present', 'absent', 'late', 'early_leave', 'on_leave') DEFAULT 'present',
        duration DECIMAL(5,2) NULL COMMENT 'Hours worked',
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_employee_date (employee_id, date),
        INDEX idx_date (date),
        INDEX idx_status (status),
        INDEX idx_employee_date (employee_id, date)
      );
    `;

    await dbPool.query(query);
    console.log("✅ Attendance table created successfully!");

    // Add sample data for testing
    console.log("📝 Inserting sample attendance data...");

    // Get some employees
    const [employees] = await dbPool.query(
      "SELECT id FROM users WHERE status = 'active' LIMIT 10"
    );

    const today = new Date();
    const statuses = ["present", "present", "present", "late", "on_leave"];

    for (const emp of employees as any[]) {
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const checkIn =
          status !== "absent" && status !== "on_leave"
            ? `${dateStr} ${status === "late" ? "09:15:00" : "08:00:00"}`
            : null;
        const checkOut = checkIn
          ? `${dateStr} ${status === "early_leave" ? "16:30:00" : "17:30:00"}`
          : null;
        const duration =
          checkIn && checkOut ? (status === "early_leave" ? 7.5 : 9.5) : null;

        try {
          await dbPool.query(
            `INSERT INTO attendance (id, employee_id, date, check_in, check_out, status, duration)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [emp.id, dateStr, checkIn, checkOut, status, duration]
          );
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    }

    console.log("✅ Sample data inserted successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
}

createAttendanceTable();
