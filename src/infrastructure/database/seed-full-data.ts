import bcrypt from "bcryptjs";
import { createConnection } from "./connection.js";

// Seed comprehensive data for Nexus system
async function seedFullData() {
  const db = await createConnection();
  console.log("\n🌱 Starting full database seeding...\n");

  try {
    // 1. Clear existing data (in reverse order of dependencies)
    console.log("🗑️  Clearing existing data...");
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    await db.query("DELETE FROM user_sessions");
    await db.query("DELETE FROM notifications");
    await db.query("DELETE FROM activity_logs");
    await db.query("DELETE FROM news_article_tags");
    await db.query("DELETE FROM news_articles");
    await db.query("DELETE FROM forum_votes");
    await db.query("DELETE FROM forum_comments");
    await db.query("DELETE FROM forum_post_tags");
    await db.query("DELETE FROM forum_posts");
    await db.query("DELETE FROM forum_categories");
    await db.query("DELETE FROM event_attendees");
    await db.query("DELETE FROM event_departments");
    await db.query("DELETE FROM events");
    await db.query("DELETE FROM meeting_bookings");
    await db.query("DELETE FROM task_comments");
    await db.query("DELETE FROM task_checklist_items");
    await db.query("DELETE FROM task_attachments");
    await db.query("DELETE FROM task_tags");
    await db.query("DELETE FROM tasks");
    await db.query("DELETE FROM project_documents");
    await db.query("DELETE FROM project_departments");
    await db.query("DELETE FROM project_reports");
    await db.query("DELETE FROM projects");
    await db.query("DELETE FROM users");
    await db.query("DELETE FROM departments");
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Data cleared\n");

    // 2. Seed Departments
    console.log("📁 Seeding departments...");
    const departments = [
      {
        id: crypto.randomUUID(),
        name: "Phòng Công nghệ thông tin",
        description: "Quản lý hệ thống và phát triển phần mềm",
        manager_id: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Phòng Nhân sự",
        description: "Quản lý nhân sự và đào tạo",
        manager_id: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Phòng Tài chính - Kế toán",
        description: "Quản lý tài chính và kế toán",
        manager_id: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Phòng Marketing",
        description: "Marketing và truyền thông",
        manager_id: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Phòng Kinh doanh",
        description: "Phát triển kinh doanh và chăm sóc khách hàng",
        manager_id: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Phòng Hành chính",
        description: "Quản lý hành chính và văn phòng",
        manager_id: null,
      },
    ];

    for (const dept of departments) {
      await db.query(
        "INSERT INTO departments (id, name, description, manager_id, parent_department_id) VALUES (?, ?, ?, ?, ?)",
        [dept.id, dept.name, dept.description, dept.manager_id, null]
      );
    }
    console.log(`✅ Created ${departments.length} departments\n`);

    // 3. Seed Users
    console.log("👥 Seeding users...");
    const hashedPassword = await bcrypt.hash("123456", 10);
    const users = [
      {
        id: crypto.randomUUID(),
        employee_id: "NX001",
        email: "admin@nexus.com",
        password_hash: await bcrypt.hash("admin123", 10),
        full_name: "Nguyễn Văn Admin",
        phone: "0901234567",
        department_id: departments[0].id,
        position: "Giám đốc CNTT",
        role: "Admin",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=12",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX002",
        email: "nguyenvana@nexus.com",
        password_hash: hashedPassword,
        full_name: "Nguyễn Văn A",
        phone: "0901234568",
        department_id: departments[0].id,
        position: "Senior Developer",
        role: "Employee",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=1",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX003",
        email: "tranthib@nexus.com",
        password_hash: hashedPassword,
        full_name: "Trần Thị B",
        phone: "0901234569",
        department_id: departments[1].id,
        position: "HR Manager",
        role: "Manager",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=5",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX004",
        email: "levanc@nexus.com",
        password_hash: hashedPassword,
        full_name: "Lê Văn C",
        phone: "0901234570",
        department_id: departments[2].id,
        position: "Accountant",
        role: "Employee",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=3",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX005",
        email: "phamthid@nexus.com",
        password_hash: hashedPassword,
        full_name: "Phạm Thị D",
        phone: "0901234571",
        department_id: departments[3].id,
        position: "Marketing Executive",
        role: "Employee",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=9",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX006",
        email: "hoangvane@nexus.com",
        password_hash: hashedPassword,
        full_name: "Hoàng Văn E",
        phone: "0901234572",
        department_id: departments[0].id,
        position: "Frontend Developer",
        role: "Employee",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=7",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX007",
        email: "vuthif@nexus.com",
        password_hash: hashedPassword,
        full_name: "Vũ Thị F",
        phone: "0901234573",
        department_id: departments[1].id,
        position: "Recruiter",
        role: "Employee",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=10",
      },
      {
        id: crypto.randomUUID(),
        employee_id: "NX008",
        email: "dangvang@nexus.com",
        password_hash: hashedPassword,
        full_name: "Đặng Văn G",
        phone: "0901234574",
        department_id: departments[4].id,
        position: "Sales Manager",
        role: "Manager",
        status: "Active",
        avatar_url: "https://i.pravatar.cc/150?img=8",
      },
    ];

    for (const user of users) {
      await db.query(
        `INSERT INTO users (id, employee_id, email, password_hash, full_name, phone, 
         department_id, position, role, status, avatar_url, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          user.id,
          user.employee_id,
          user.email,
          user.password_hash,
          user.full_name,
          user.phone,
          user.department_id,
          user.position,
          user.role,
          user.status,
          user.avatar_url,
        ]
      );
    }
    console.log(`✅ Created ${users.length} users\n`);

    // 4. Seed Projects
    console.log("📊 Seeding projects...");
    const projects = [
      {
        id: crypto.randomUUID(),
        name: "Hệ thống quản lý nội bộ Nexus",
        description: "Phát triển hệ thống quản lý nội bộ toàn diện cho công ty",
        start_date: "2024-01-15",
        end_date: "2024-12-31",
        status: "In Progress",
        priority: "High",
        budget: 500000000,
        owner_id: users[0].id,
      },
      {
        id: crypto.randomUUID(),
        name: "Chiến dịch Marketing Q1 2024",
        description: "Triển khai các hoạt động marketing quý 1",
        start_date: "2024-01-01",
        end_date: "2024-03-31",
        status: "Done",
        priority: "Medium",
        budget: 200000000,
        owner_id: users[4].id,
      },
      {
        id: crypto.randomUUID(),
        name: "Tuyển dụng nhân sự 2024",
        description: "Kế hoạch tuyển dụng 50 nhân sự mới",
        start_date: "2024-02-01",
        end_date: "2024-06-30",
        status: "In Progress",
        priority: "High",
        budget: 100000000,
        owner_id: users[2].id,
      },
    ];

    for (const project of projects) {
      const code = `PRJ${String(projects.indexOf(project) + 1).padStart(
        3,
        "0"
      )}`;
      await db.query(
        `INSERT INTO projects (id, code, name, description, start_date, end_date, status, 
         priority, budget, manager_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          project.id,
          code,
          project.name,
          project.description,
          project.start_date,
          project.end_date,
          project.status,
          project.priority,
          project.budget,
          project.owner_id,
        ]
      );
    }
    console.log(`✅ Created ${projects.length} projects\n`);

    // 5. Seed Tasks
    console.log("✅ Seeding tasks...");
    const tasks = [
      {
        id: crypto.randomUUID(),
        project_id: projects[0].id,
        title: "Thiết kế UI/UX cho module Dashboard",
        description: "Thiết kế giao diện người dùng cho trang Dashboard chính",
        status: "Done",
        priority: "High",
        due_date: "2024-02-15",
        created_by: users[0].id,
      },
      {
        id: crypto.randomUUID(),
        project_id: projects[0].id,
        title: "Phát triển API Authentication",
        description: "Xây dựng hệ thống xác thực và phân quyền người dùng",
        status: "In Progress",
        priority: "High",
        due_date: "2024-03-01",
        created_by: users[0].id,
      },
      {
        id: crypto.randomUUID(),
        project_id: projects[0].id,
        title: "Tích hợp cơ sở dữ liệu MySQL",
        description: "Thiết lập và tích hợp database cho hệ thống",
        status: "Done",
        priority: "High",
        due_date: "2024-02-20",
        created_by: users[0].id,
      },
      {
        id: crypto.randomUUID(),
        project_id: projects[1].id,
        title: "Lên kế hoạch content marketing",
        description: "Xây dựng lịch đăng bài và nội dung cho Q1",
        status: "Done",
        priority: "Medium",
        due_date: "2024-01-15",
        created_by: users[4].id,
      },
      {
        id: crypto.randomUUID(),
        project_id: projects[2].id,
        title: "Đăng tin tuyển dụng",
        description: "Đăng tin tuyển dụng lên các kênh",
        status: "In Progress",
        priority: "Medium",
        due_date: "2024-03-01",
        created_by: users[2].id,
      },
    ];

    for (const task of tasks) {
      await db.query(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, 
         due_date, created_by, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          task.id,
          task.project_id,
          task.title,
          task.description,
          task.status,
          task.priority,
          task.due_date,
          task.created_by,
        ]
      );
    }
    console.log(`✅ Created ${tasks.length} tasks\n`);

    // 6. Seed Forum Categories
    console.log("💬 Seeding forum categories...");
    const forumCategories = [
      {
        id: crypto.randomUUID(),
        name: "Công nghệ",
        description: "Thảo luận về công nghệ và lập trình",
        icon: "Cpu",
        color: "text-blue-600",
      },
      {
        id: crypto.randomUUID(),
        name: "Thông báo chung",
        description: "Thông báo và tin tức công ty",
        icon: "Bell",
        color: "text-orange-600",
      },
      {
        id: crypto.randomUUID(),
        name: "Hỏi đáp",
        description: "Hỏi đáp và chia sẻ kinh nghiệm",
        icon: "HelpCircle",
        color: "text-purple-600",
      },
      {
        id: crypto.randomUUID(),
        name: "Mua bán",
        description: "Mua bán đồ cũ nội bộ",
        icon: "ShoppingBag",
        color: "text-green-600",
      },
    ];

    for (const category of forumCategories) {
      await db.query(
        `INSERT INTO forum_categories (id, name, description, icon, color_class, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          category.id,
          category.name,
          category.description,
          category.icon,
          category.color,
        ]
      );
    }
    console.log(`✅ Created ${forumCategories.length} forum categories\n`);

    // 7. Seed Forum Posts
    console.log("📝 Seeding forum posts...");
    const forumPosts = [
      {
        id: crypto.randomUUID(),
        category_id: forumCategories[0].id,
        author_id: users[1].id,
        title: "Chia sẻ tips tối ưu React Performance",
        content:
          "Mình muốn chia sẻ một số tips để tối ưu performance cho React app. 1. Sử dụng React.memo cho components không cần re-render. 2. Tận dụng useMemo và useCallback...",
        status: "Approved",
        is_pinned: true,
        view_count: 234,
      },
      {
        id: crypto.randomUUID(),
        category_id: forumCategories[1].id,
        author_id: users[0].id,
        title: "Thông báo: Nghỉ lễ 30/4 - 1/5",
        content:
          "Công ty thông báo lịch nghỉ lễ Giải phóng Miền Nam và Quốc tế Lao động từ ngày 30/4 đến 1/5. Toàn thể CBNV được nghỉ 4 ngày liên tiếp.",
        status: "Approved",
        is_pinned: true,
        view_count: 456,
      },
      {
        id: crypto.randomUUID(),
        category_id: forumCategories[2].id,
        author_id: users[5].id,
        title: "Hỏi về quy trình onboarding nhân viên mới",
        content:
          "Cho mình hỏi quy trình onboarding cho nhân viên mới gia nhập như thế nào? Cần chuẩn bị những gì?",
        status: "Approved",
        is_pinned: false,
        view_count: 89,
      },
      {
        id: crypto.randomUUID(),
        category_id: forumCategories[3].id,
        author_id: users[4].id,
        title: "Bán iPhone 13 Pro Max giá tốt",
        content:
          "Mình cần bán iPhone 13 Pro Max 256GB, máy đẹp 99%, còn bảo hành 6 tháng. Giá 20 triệu có thương lượng.",
        status: "Approved",
        is_pinned: false,
        view_count: 145,
      },
    ];

    for (const post of forumPosts) {
      await db.query(
        `INSERT INTO forum_posts (id, category_id, author_id, title, content, status, 
         is_pinned, view_count, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          post.id,
          post.category_id,
          post.author_id,
          post.title,
          post.content,
          post.status,
          post.is_pinned,
          post.view_count,
        ]
      );
    }
    console.log(`✅ Created ${forumPosts.length} forum posts\n`);

    // 8. Seed News Articles
    console.log("📰 Seeding news articles...");
    const newsArticles = [
      {
        id: crypto.randomUUID(),
        title: "Nexus đạt doanh thu kỷ lục trong Q1/2024",
        summary:
          "Công ty đạt mức doanh thu cao nhất từ trước đến nay với sự tăng trưởng 150% so với cùng kỳ năm ngoái",
        content:
          "Trong quý đầu tiên của năm 2024, Nexus đã ghi nhận sự tăng trưởng vượt bậc với doanh thu đạt 50 tỷ đồng, tăng 150% so với cùng kỳ năm 2023...",
        author_id: users[4].id,
        category: "Announcement",
        status: "Published",
        featured_image: "https://picsum.photos/800/400?random=1",
        view_count: 1234,
        published_at: new Date(),
      },
      {
        id: crypto.randomUUID(),
        title: "Ra mắt sản phẩm mới: Nexus Cloud Platform",
        summary:
          "Nền tảng điện toán đám mây mới của Nexus hứa hẹn cách mạng hóa cách thức triển khai ứng dụng",
        content:
          "Sau 6 tháng nghiên cứu và phát triển, Nexus chính thức ra mắt Nexus Cloud Platform - giải pháp cloud computing toàn diện...",
        author_id: users[0].id,
        category: "Strategy",
        status: "Published",
        featured_image: "https://picsum.photos/800/400?random=2",
        view_count: 567,
        published_at: new Date(),
      },
      {
        id: crypto.randomUUID(),
        title: "Chương trình đào tạo kỹ năng mềm cho nhân viên",
        summary:
          "Công ty tổ chức khóa đào tạo kỹ năng mềm miễn phí cho toàn thể nhân viên",
        content:
          "Nhằm nâng cao năng lực làm việc của đội ngũ, Nexus sẽ tổ chức series workshop về kỹ năng mềm trong tháng 3...",
        author_id: users[2].id,
        category: "Culture",
        status: "Published",
        featured_image: "https://picsum.photos/800/400?random=3",
        view_count: 234,
        published_at: new Date(),
      },
    ];

    for (const news of newsArticles) {
      await db.query(
        `INSERT INTO news_articles (id, title, summary, content, author_id, category, 
         status, cover_image, view_count, published_at, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          news.id,
          news.title,
          news.summary,
          news.content,
          news.author_id,
          news.category,
          news.status,
          news.featured_image,
          news.view_count,
          news.published_at,
        ]
      );
    }
    console.log(`✅ Created ${newsArticles.length} news articles\n`);

    // 9. Seed Events
    console.log("🎉 Seeding events...");
    const events = [
      {
        id: crypto.randomUUID(),
        title: "Year End Party 2024",
        description:
          "Tiệc tất niên công ty với nhiều hoạt động thú vị và giải thưởng hấp dẫn",
        type: "Party",
        start_date: "2024-12-25",
        end_date: "2024-12-25",
        start_time: "18:00:00",
        end_time: "22:00:00",
        location: "Gem Center, Quận 1",
        max_participants: 200,
        organizer_id: users[2].id,
        status: "Upcoming",
      },
      {
        id: crypto.randomUUID(),
        title: "Workshop: Git & GitHub Best Practices",
        description:
          "Workshop về cách sử dụng Git và GitHub hiệu quả trong team",
        type: "Workshop",
        start_date: "2024-03-15",
        end_date: "2024-03-15",
        start_time: "14:00:00",
        end_time: "17:00:00",
        location: "Phòng họp A, Tầng 5",
        max_participants: 30,
        organizer_id: users[0].id,
        status: "Upcoming",
      },
      {
        id: crypto.randomUUID(),
        title: "Team Building Q1 2024",
        description: "Hoạt động team building cho toàn công ty tại Vũng Tàu",
        type: "Training",
        start_date: "2024-03-23",
        end_date: "2024-03-24",
        start_time: "07:00:00",
        end_time: "18:00:00",
        location: "Vũng Tàu",
        max_participants: 100,
        organizer_id: users[2].id,
        status: "Upcoming",
      },
    ];

    for (const event of events) {
      const startDatetime = `${event.start_date} ${event.start_time}`;
      const endDatetime = `${event.end_date} ${event.end_time}`;
      await db.query(
        `INSERT INTO events (id, title, description, type, start_datetime, end_datetime, 
         location, max_attendees, organizer_id, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          event.id,
          event.title,
          event.description,
          event.type,
          startDatetime,
          endDatetime,
          event.location,
          event.max_participants,
          event.organizer_id,
          event.status,
        ]
      );
    }
    console.log(`✅ Created ${events.length} events\n`);

    // 10. Seed Notifications
    console.log("🔔 Seeding notifications...");
    const notifications = [
      {
        id: crypto.randomUUID(),
        title: "Bạn được assign vào task mới",
        message: "Bạn được phân công task 'Phát triển API Authentication'",
        type: "system",
      },
      {
        id: crypto.randomUUID(),
        title: "Meeting sắp diễn ra",
        message: "Sprint Planning Meeting sẽ bắt đầu sau 15 phút",
        type: "system",
      },
      {
        id: crypto.randomUUID(),
        title: "Có bài viết mới trong diễn đàn",
        message:
          "Nguyễn Văn A đã đăng bài 'Chia sẻ tips tối ưu React Performance'",
        type: "comment",
      },
    ];

    for (const notification of notifications) {
      await db.query(
        `INSERT INTO notifications (id, title, message, type, user_id, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          notification.id,
          notification.title,
          notification.message,
          notification.type,
          users[0].id, // Send to admin user
        ]
      );
    }
    console.log(`✅ Created ${notifications.length} notifications\n`);

    // 12. Seed Activity Logs
    console.log("📊 Seeding activity logs...");
    const activityLogs = [
      {
        id: crypto.randomUUID(),
        user_id: users[1].id,
        type: "post_create",
        content: "Tạo bài viết 'Chia sẻ tips tối ưu React Performance'",
        target: forumPosts[0].id,
      },
      {
        id: crypto.randomUUID(),
        user_id: users[0].id,
        type: "task_complete",
        content: "Hoàn thành task 'Phát triển API Authentication'",
        target: tasks[1].id,
      },
      {
        id: crypto.randomUUID(),
        user_id: users[2].id,
        type: "system",
        content: "Tạo sự kiện 'Year End Party 2024'",
        target: events[0].id,
      },
    ];

    for (const log of activityLogs) {
      await db.query(
        `INSERT INTO activity_logs (id, user_id, type, content, target, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [log.id, log.user_id, log.type, log.content, log.target]
      );
    }
    console.log(`✅ Created ${activityLogs.length} activity logs\n`);

    console.log("\n✅ ========================================");
    console.log("✅ FULL DATA SEEDING COMPLETED!");
    console.log("✅ ========================================\n");
    console.log("📊 Summary:");
    console.log(`   - ${departments.length} departments`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${projects.length} projects`);
    console.log(`   - ${tasks.length} tasks`);
    console.log(`   - ${forumCategories.length} forum categories`);
    console.log(`   - ${forumPosts.length} forum posts`);
    console.log(`   - ${newsArticles.length} news articles`);
    console.log(`   - ${events.length} events`);
    console.log(`   - ${notifications.length} notifications`);
    console.log(`   - ${activityLogs.length} activity logs\n`);
    console.log("🔑 Login credentials:");
    console.log("   Admin: admin@nexus.com / admin123");
    console.log("   Users: nguyenvana@nexus.com / 123456");
    console.log("          tranthib@nexus.com / 123456");
    console.log("          (and others with password: 123456)\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedFullData();
