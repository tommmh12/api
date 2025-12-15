import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "nexus_db",
  });

  try {
    console.log("🔄 Running notification settings migration...\n");

    // 1. Create user_notification_settings table
    console.log("📋 Creating user_notification_settings table...");
    await connection.query(`
            CREATE TABLE IF NOT EXISTS user_notification_settings (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                user_id CHAR(36) NOT NULL,
                
                -- Notification channels
                email_enabled BOOLEAN DEFAULT TRUE,
                push_enabled BOOLEAN DEFAULT TRUE,
                sms_enabled BOOLEAN DEFAULT FALSE,
                in_app_enabled BOOLEAN DEFAULT TRUE,
                
                -- Notification types
                notify_on_comment BOOLEAN DEFAULT TRUE,
                notify_on_mention BOOLEAN DEFAULT TRUE,
                notify_on_task_assign BOOLEAN DEFAULT TRUE,
                notify_on_task_update BOOLEAN DEFAULT TRUE,
                notify_on_task_complete BOOLEAN DEFAULT TRUE,
                notify_on_project_update BOOLEAN DEFAULT TRUE,
                notify_on_meeting BOOLEAN DEFAULT TRUE,
                notify_on_meeting_invite BOOLEAN DEFAULT TRUE,
                notify_on_booking_status BOOLEAN DEFAULT TRUE,
                notify_on_news BOOLEAN DEFAULT TRUE,
                notify_on_forum_reply BOOLEAN DEFAULT TRUE,
                notify_on_chat_message BOOLEAN DEFAULT TRUE,
                notify_on_system_alert BOOLEAN DEFAULT TRUE,
                notify_on_personnel_change BOOLEAN DEFAULT TRUE,
                
                -- Do Not Disturb settings
                dnd_enabled BOOLEAN DEFAULT FALSE,
                dnd_start_time TIME DEFAULT '22:00:00',
                dnd_end_time TIME DEFAULT '07:00:00',
                dnd_weekends_only BOOLEAN DEFAULT FALSE,
                
                -- Email digest settings
                email_digest_enabled BOOLEAN DEFAULT FALSE,
                email_digest_frequency ENUM('daily', 'weekly') DEFAULT 'daily',
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_user_settings (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("✅ user_notification_settings table created/exists\n");

    // 2. Check and add columns to notifications table
    console.log("📋 Updating notifications table...");

    // Check if columns exist
    const [notifColumns]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
        `);
    const notifColNames = notifColumns.map((c: any) => c.COLUMN_NAME);

    if (!notifColNames.includes("priority")) {
      await connection.query(
        `ALTER TABLE notifications ADD COLUMN priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal'`
      );
      console.log("  ✅ Added priority column");
    } else {
      console.log("  ⏭️  priority column already exists");
    }

    if (!notifColNames.includes("expires_at")) {
      await connection.query(
        `ALTER TABLE notifications ADD COLUMN expires_at TIMESTAMP NULL`
      );
      console.log("  ✅ Added expires_at column");
    } else {
      console.log("  ⏭️  expires_at column already exists");
    }

    // 3. Check and add columns to activity_logs table
    console.log("\n📋 Updating activity_logs table...");

    const [actColumns]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_logs'
        `);
    const actColNames = actColumns.map((c: any) => c.COLUMN_NAME);

    if (!actColNames.includes("device_info")) {
      await connection.query(
        `ALTER TABLE activity_logs ADD COLUMN device_info JSON`
      );
      console.log("  ✅ Added device_info column");
    } else {
      console.log("  ⏭️  device_info column already exists");
    }

    if (!actColNames.includes("location")) {
      await connection.query(
        `ALTER TABLE activity_logs ADD COLUMN location VARCHAR(255)`
      );
      console.log("  ✅ Added location column");
    } else {
      console.log("  ⏭️  location column already exists");
    }

    if (!actColNames.includes("duration_ms")) {
      await connection.query(
        `ALTER TABLE activity_logs ADD COLUMN duration_ms INT`
      );
      console.log("  ✅ Added duration_ms column");
    } else {
      console.log("  ⏭️  duration_ms column already exists");
    }

    if (!actColNames.includes("status")) {
      await connection.query(
        `ALTER TABLE activity_logs ADD COLUMN status ENUM('success', 'failed', 'pending') DEFAULT 'success'`
      );
      console.log("  ✅ Added status column");
    } else {
      console.log("  ⏭️  status column already exists");
    }

    if (!actColNames.includes("error_message")) {
      await connection.query(
        `ALTER TABLE activity_logs ADD COLUMN error_message TEXT`
      );
      console.log("  ✅ Added error_message column");
    } else {
      console.log("  ⏭️  error_message column already exists");
    }

    // 4. Create indexes
    console.log("\n📋 Creating indexes...");

    try {
      await connection.query(
        `CREATE INDEX idx_notifications_priority ON notifications(user_id, priority, created_at)`
      );
      console.log("  ✅ Created idx_notifications_priority");
    } catch (err: any) {
      if (err.code === "ER_DUP_KEYNAME") {
        console.log("  ⏭️  idx_notifications_priority already exists");
      } else {
        console.log("  ⚠️  idx_notifications_priority:", err.message);
      }
    }

    try {
      await connection.query(
        `CREATE INDEX idx_activity_logs_status ON activity_logs(status, created_at)`
      );
      console.log("  ✅ Created idx_activity_logs_status");
    } catch (err: any) {
      if (err.code === "ER_DUP_KEYNAME") {
        console.log("  ⏭️  idx_activity_logs_status already exists");
      } else {
        console.log("  ⚠️  idx_activity_logs_status:", err.message);
      }
    }

    try {
      await connection.query(
        `CREATE INDEX idx_user_notification_settings_user ON user_notification_settings(user_id)`
      );
      console.log("  ✅ Created idx_user_notification_settings_user");
    } catch (err: any) {
      if (err.code === "ER_DUP_KEYNAME") {
        console.log("  ⏭️  idx_user_notification_settings_user already exists");
      } else {
        console.log("  ⚠️  idx_user_notification_settings_user:", err.message);
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
