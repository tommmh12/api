import { dbPool } from "../infrastructure/database/connection.js";
import crypto from "crypto";

async function seedDashboardData() {
  try {
    console.log("🌱 Starting dashboard data seeding...");

    // Get user IDs
    const [users]: any = await dbPool.query(
      "SELECT id, full_name FROM users WHERE deleted_at IS NULL LIMIT 10"
    );

    if (users.length === 0) {
      console.log("❌ No users found. Please seed users first.");
      process.exit(1);
    }

    // Seed Forum Posts
    console.log("\n📝 Seeding forum posts...");
    const forumTopics = [
      {
        title: "Chào mừng các thành viên mới",
        content: "Hãy giới thiệu về bản thân để mọi người cùng làm quen nhé!",
      },
      {
        title: "Góp ý cải thiện hệ thống nội bộ",
        content:
          "Các bạn có ý kiến gì về hệ thống Nexus không? Mình nghe ý kiến đóng góp nha!",
      },
      {
        title: "Team Building Q1 2025",
        content: "Ai có ý tưởng cho hoạt động team building không ạ?",
      },
      {
        title: "Chia sẻ kinh nghiệm làm việc",
        content: "Mọi người chia sẻ tips làm việc hiệu quả nào!",
      },
      {
        title: "Thông báo nghỉ lễ",
        content: "Lịch nghỉ lễ năm 2025 như sau...",
      },
    ];

    for (const topic of forumTopics) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await dbPool.query(
        `INSERT INTO forum_posts (id, title, content, author_id, category, status, views, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'General', 'Active', ?, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          topic.title,
          topic.content,
          randomUser.id,
          Math.floor(Math.random() * 100),
        ]
      );
    }
    console.log(`✅ Created ${forumTopics.length} forum posts`);

    // Seed News Articles
    console.log("\n📰 Seeding news articles...");
    const news = [
      {
        title: "Công ty đạt doanh thu kỷ lục Q4 2024",
        content: "Chúc mừng toàn thể nhân viên đã cố gắng...",
        category: "Company",
      },
      {
        title: "Ra mắt sản phẩm mới",
        content: "Sản phẩm ABC chính thức được giới thiệu...",
        category: "Product",
      },
      {
        title: "Tuyển dụng vị trí Senior Developer",
        content: "Phòng IT đang tìm kiếm ứng viên...",
        category: "Recruitment",
      },
      {
        title: "Workshop: Kỹ năng làm việc nhóm",
        content: "Đào tạo nội bộ về teamwork...",
        category: "Training",
      },
    ];

    for (const article of news) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await dbPool.query(
        `INSERT INTO news_articles (id, title, content, author_id, category, status, views, featured, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Published', ?, ?, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          article.title,
          article.content,
          randomUser.id,
          article.category,
          Math.floor(Math.random() * 200),
          Math.random() > 0.5 ? 1 : 0,
        ]
      );
    }
    console.log(`✅ Created ${news.length} news articles`);

    // Seed Events
    console.log("\n📅 Seeding events...");
    const events = [
      {
        title: "Họp toàn thể cuối năm",
        start: "2025-01-15 09:00:00",
        end: "2025-01-15 12:00:00",
      },
      {
        title: "Training AWS Cloud",
        start: "2025-01-20 14:00:00",
        end: "2025-01-20 17:00:00",
      },
      {
        title: "Team Building",
        start: "2025-02-01 08:00:00",
        end: "2025-02-01 18:00:00",
      },
      {
        title: "Review KPI Q1",
        start: "2025-03-31 10:00:00",
        end: "2025-03-31 11:30:00",
      },
    ];

    for (const event of events) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await dbPool.query(
        `INSERT INTO events (id, title, description, organizer_id, start_time, end_time, location, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Upcoming', NOW(), NOW())`,
        [
          crypto.randomUUID(),
          event.title,
          `Sự kiện ${event.title}`,
          randomUser.id,
          event.start,
          event.end,
          "Phòng họp tầng 3",
        ]
      );
    }
    console.log(`✅ Created ${events.length} events`);

    // Seed Activity Logs
    console.log("\n📊 Seeding activity logs...");
    const activities = [
      {
        type: "project_created",
        content: "đã tạo dự án mới",
        target: "projects",
      },
      {
        type: "task_completed",
        content: "đã hoàn thành task",
        target: "tasks",
      },
      { type: "user_joined", content: "đã tham gia hệ thống", target: "users" },
      {
        type: "comment_added",
        content: "đã bình luận trên dự án",
        target: "projects",
      },
      {
        type: "file_uploaded",
        content: "đã tải lên tài liệu",
        target: "files",
      },
      {
        type: "meeting_scheduled",
        content: "đã lên lịch họp",
        target: "events",
      },
      {
        type: "announcement",
        content: "đã đăng thông báo mới",
        target: "news",
      },
      { type: "task_assigned", content: "đã giao task mới", target: "tasks" },
    ];

    for (let i = 0; i < 20; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomActivity =
        activities[Math.floor(Math.random() * activities.length)];
      const hoursAgo = Math.floor(Math.random() * 72); // Random within last 3 days

      await dbPool.query(
        `INSERT INTO activity_logs (id, user_id, type, content, target, created_at)
         VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
        [
          crypto.randomUUID(),
          randomUser.id,
          randomActivity.type,
          randomActivity.content,
          randomActivity.target,
          hoursAgo,
        ]
      );
    }
    console.log(`✅ Created 20 activity logs`);

    console.log("\n🎉 Dashboard data seeding completed successfully!");
  } catch (error: any) {
    console.error("❌ Error seeding dashboard data:", error.message);
    if (error.code === "ER_NO_SUCH_TABLE") {
      console.log("\n⚠️  Some tables don't exist. Creating them...");
      // You may need to create these tables first
    }
  } finally {
    process.exit(0);
  }
}

seedDashboardData();
