import { dbPool } from "./src/infrastructure/database/connection.js";
import crypto from "crypto";

async function seedNews() {
  console.log("🌱 Bắt đầu thêm dữ liệu bản tin mẫu...");

  try {
    // Lấy admin user
    const [users] = await dbPool.query<any[]>(
      "SELECT id, full_name FROM users WHERE role = 'Admin' LIMIT 1"
    );

    if (users.length === 0) {
      console.log("❌ Không tìm thấy Admin user");
      return;
    }

    const adminId = users[0].id;
    const adminName = users[0].full_name;
    console.log(`✅ Tìm thấy Admin: ${adminName}`);

    // Kiểm tra xem đã có bài viết chưa
    const [existingNews] = await dbPool.query<any[]>(
      "SELECT COUNT(*) as count FROM news_articles WHERE deleted_at IS NULL"
    );

    console.log(`📰 Số bài viết hiện có: ${existingNews[0].count}`);

    // Thêm các bài viết mẫu
    const newsArticles = [
      {
        id: crypto.randomUUID(),
        title:
          "🎉 Chào mừng đến với NEXUS - Cổng thông tin nội bộ doanh nghiệp",
        summary:
          "NEXUS là nền tảng kết nối và chia sẻ thông tin hiện đại, giúp nhân viên cập nhật tin tức, sự kiện và tài liệu quan trọng của công ty một cách nhanh chóng và hiệu quả.",
        content: `
          <h2>Giới thiệu về NEXUS</h2>
          <p>NEXUS là cổng thông tin nội bộ được thiết kế dành riêng cho doanh nghiệp, nhằm tăng cường kết nối giữa các phòng ban và cải thiện hiệu suất làm việc.</p>
          
          <h3>Các tính năng chính:</h3>
          <ul>
            <li><strong>Bản tin công ty:</strong> Cập nhật tin tức, thông báo quan trọng</li>
            <li><strong>Diễn đàn nội bộ:</strong> Trao đổi, chia sẻ kiến thức</li>
            <li><strong>Quản lý dự án:</strong> Theo dõi tiến độ công việc</li>
            <li><strong>Phòng họp online:</strong> Họp trực tuyến qua Jitsi</li>
            <li><strong>Đặt phòng họp:</strong> Quản lý lịch phòng họp</li>
          </ul>
          
          <h3>Lợi ích khi sử dụng NEXUS:</h3>
          <p>- Tiết kiệm thời gian tìm kiếm thông tin</p>
          <p>- Tăng cường giao tiếp giữa các bộ phận</p>
          <p>- Quản lý công việc hiệu quả hơn</p>
          <p>- Xây dựng văn hóa doanh nghiệp số</p>
        `,
        category: "Announcement",
        coverImage:
          "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200",
        status: "Published",
        isFeatured: true,
        isPublic: true,
      },
      {
        id: crypto.randomUUID(),
        title: "📊 Kết quả kinh doanh Q4/2024 - Vượt chỉ tiêu 15%",
        summary:
          "Công ty đã hoàn thành xuất sắc kế hoạch kinh doanh quý 4 năm 2024 với mức tăng trưởng 15% so với mục tiêu đề ra. Đây là thành quả của sự nỗ lực không ngừng từ toàn thể nhân viên.",
        content: `
          <h2>Kết quả kinh doanh ấn tượng</h2>
          <p>Quý 4/2024 đánh dấu một cột mốc quan trọng trong lịch sử phát triển của công ty. Chúng ta đã đạt được những kết quả vượt trội:</p>
          
          <h3>Những con số nổi bật:</h3>
          <ul>
            <li>Doanh thu tăng <strong>15%</strong> so với kế hoạch</li>
            <li>Số khách hàng mới tăng <strong>20%</strong></li>
            <li>Tỷ lệ hài lòng khách hàng đạt <strong>95%</strong></li>
            <li>Hoàn thành <strong>98%</strong> dự án đúng tiến độ</li>
          </ul>
          
          <h3>Lời cảm ơn</h3>
          <p>Ban lãnh đạo xin gửi lời cảm ơn chân thành đến toàn thể nhân viên vì sự cống hiến và nỗ lực không ngừng nghỉ. Thành công này là của tất cả chúng ta!</p>
          
          <h3>Kế hoạch năm 2025</h3>
          <p>Với đà phát triển này, chúng ta đặt mục tiêu tăng trưởng 25% trong năm 2025. Hãy cùng nhau tiếp tục nỗ lực!</p>
        `,
        category: "Strategy",
        coverImage:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200",
        status: "Published",
        isFeatured: true,
        isPublic: true,
      },
      {
        id: crypto.randomUUID(),
        title: "🎄 Thông báo lịch nghỉ Tết Nguyên Đán 2025",
        summary:
          "Công ty thông báo lịch nghỉ Tết Nguyên Đán Ất Tỵ 2025 từ ngày 25/01 đến hết ngày 02/02/2025. Toàn thể nhân viên vui lòng sắp xếp công việc trước khi nghỉ Tết.",
        content: `
          <h2>Thông báo lịch nghỉ Tết Nguyên Đán 2025</h2>
          <p>Ban Giám đốc thông báo lịch nghỉ Tết Nguyên Đán Ất Tỵ 2025 như sau:</p>
          
          <h3>Thời gian nghỉ:</h3>
          <p><strong>Từ: 25/01/2025 (Thứ Bảy, 26 tháng Chạp)</strong></p>
          <p><strong>Đến: 02/02/2025 (Chủ Nhật, mùng 5 Tết)</strong></p>
          <p><strong>Đi làm trở lại: 03/02/2025 (Thứ Hai, mùng 6 Tết)</strong></p>
          
          <h3>Lưu ý quan trọng:</h3>
          <ul>
            <li>Hoàn thành và bàn giao công việc trước ngày 24/01/2025</li>
            <li>Kiểm tra và tắt các thiết bị điện trước khi nghỉ</li>
            <li>Cập nhật số điện thoại liên lạc khẩn cấp với HR</li>
            <li>Lịch trực Tết sẽ được thông báo riêng</li>
          </ul>
          
          <h3>Chúc mừng năm mới!</h3>
          <p>Ban Giám đốc kính chúc toàn thể nhân viên và gia đình một năm mới Ất Tỵ 2025 an khang thịnh vượng, vạn sự như ý! 🎊</p>
        `,
        category: "Announcement",
        coverImage:
          "https://images.unsplash.com/photo-1549068106-b024baf5062d?auto=format&fit=crop&q=80&w=1200",
        status: "Published",
        isFeatured: false,
        isPublic: true,
      },
      {
        id: crypto.randomUUID(),
        title: "🏆 Chương trình Nhân viên xuất sắc tháng 12/2024",
        summary:
          "Vinh danh những cá nhân có đóng góp xuất sắc trong tháng 12/2024. Cùng chúc mừng các đồng nghiệp đã nỗ lực hết mình vì sự phát triển chung của công ty.",
        content: `
          <h2>Vinh danh Nhân viên xuất sắc tháng 12/2024</h2>
          <p>Hàng tháng, công ty tổ chức bình chọn và vinh danh những cá nhân có đóng góp xuất sắc. Tháng 12/2024, chúng ta có:</p>
          
          <h3>🥇 Giải nhất: Phòng Phát triển sản phẩm</h3>
          <p>Đã hoàn thành module NEXUS trước deadline 2 tuần với chất lượng vượt kỳ vọng.</p>
          
          <h3>🥈 Giải nhì: Phòng Kinh doanh</h3>
          <p>Đạt 120% chỉ tiêu doanh số tháng với nhiều hợp đồng lớn.</p>
          
          <h3>🥉 Giải ba: Phòng Hỗ trợ khách hàng</h3>
          <p>Tỷ lệ hài lòng khách hàng đạt 98%, cao nhất trong năm.</p>
          
          <h3>Phần thưởng:</h3>
          <ul>
            <li>Giải nhất: 5.000.000 VNĐ + Chứng nhận</li>
            <li>Giải nhì: 3.000.000 VNĐ + Chứng nhận</li>
            <li>Giải ba: 2.000.000 VNĐ + Chứng nhận</li>
          </ul>
          
          <p><strong>Chúc mừng tất cả các đội!</strong> Hãy tiếp tục phát huy tinh thần này trong năm mới 2025! 🎉</p>
        `,
        category: "Culture",
        coverImage:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200",
        status: "Published",
        isFeatured: false,
        isPublic: true,
      },
      {
        id: crypto.randomUUID(),
        title: "🎉 Team Building 2025 - Đà Nẵng 3 ngày 2 đêm",
        summary:
          "Chương trình Team Building đầu năm 2025 sẽ diễn ra tại Đà Nẵng từ ngày 15-17/03/2025. Đây là dịp để toàn thể nhân viên nghỉ ngơi, gắn kết và tạo thêm nhiều kỷ niệm đẹp.",
        content: `
          <h2>Team Building 2025 - Đà Nẵng</h2>
          <p>Công ty tổ chức chương trình Team Building đầu năm với nhiều hoạt động thú vị:</p>
          
          <h3>Thời gian & Địa điểm:</h3>
          <ul>
            <li><strong>Thời gian:</strong> 15-17/03/2025 (Thứ Bảy - Thứ Hai)</li>
            <li><strong>Địa điểm:</strong> Resort 5 sao tại Đà Nẵng</li>
            <li><strong>Di chuyển:</strong> Máy bay khứ hồi</li>
          </ul>
          
          <h3>Lịch trình dự kiến:</h3>
          <p><strong>Ngày 1:</strong> Khởi hành, check-in resort, tiệc tối chào mừng</p>
          <p><strong>Ngày 2:</strong> Team games, tour Bà Nà Hills, Gala dinner</p>
          <p><strong>Ngày 3:</strong> Biển Mỹ Khê, shopping, về TP.HCM</p>
          
          <h3>Đăng ký tham gia:</h3>
          <p>Vui lòng xác nhận tham gia với HR trước ngày <strong>28/02/2025</strong></p>
          <p>Chi phí: Công ty tài trợ 100% cho nhân viên chính thức</p>
          
          <p><em>Đừng bỏ lỡ cơ hội tuyệt vời này! 🌴☀️</em></p>
        `,
        category: "Event",
        coverImage:
          "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&q=80&w=1200",
        status: "Published",
        isFeatured: true,
        isPublic: true,
      },
    ];

    // Insert news articles
    for (const article of newsArticles) {
      await dbPool.query(
        `INSERT INTO news_articles (
          id, title, summary, content, author_id, category, 
          cover_image, status, moderation_status, is_public, is_featured, 
          read_time, view_count, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?, '5 phút đọc', ?, NOW(), NOW(), NOW())`,
        [
          article.id,
          article.title,
          article.summary,
          article.content,
          adminId,
          article.category,
          article.coverImage,
          article.status,
          article.isPublic,
          article.isFeatured,
          Math.floor(Math.random() * 500) + 50, // random views
        ]
      );
      console.log(`✅ Đã thêm: ${article.title.substring(0, 50)}...`);
    }

    console.log(`\n🎉 Hoàn tất! Đã thêm ${newsArticles.length} bài viết mẫu.`);
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    await dbPool.end();
    process.exit(0);
  }
}

seedNews();
