import { dbPool } from "../infrastructure/database/connection.js";
import crypto from "crypto";

const projects = [
  // Phòng Công nghệ thông tin
  {
    code: "PRJ-IT-001",
    name: "Nâng cấp hệ thống ERP",
    department: "Phòng Công nghệ thông tin",
    status: "In Progress",
    progress: 75,
  },
  {
    code: "PRJ-IT-002",
    name: "Triển khai Cloud Infrastructure",
    department: "Phòng Công nghệ thông tin",
    status: "In Progress",
    progress: 45,
  },

  // Phòng Marketing
  {
    code: "PRJ-MKT-001",
    name: "Chiến dịch Q1 2025",
    department: "Phòng Marketing",
    status: "In Progress",
    progress: 60,
  },
  {
    code: "PRJ-MKT-002",
    name: "Website Redesign",
    department: "Phòng Marketing",
    status: "Planning",
    progress: 20,
  },

  // Phòng Kinh doanh
  {
    code: "PRJ-SALE-001",
    name: "Mở rộng thị trường miền Bắc",
    department: "Phòng Kinh doanh",
    status: "In Progress",
    progress: 55,
  },
  {
    code: "PRJ-SALE-002",
    name: "Partnership Program",
    department: "Phòng Kinh doanh",
    status: "Done",
    progress: 100,
  },

  // Phòng Nhân sự
  {
    code: "PRJ-HR-001",
    name: "Đào tạo nhân viên Q4",
    department: "Phòng Nhân sự",
    status: "In Progress",
    progress: 80,
  },

  // Phòng Tài chính - Kế toán
  {
    code: "PRJ-FIN-001",
    name: "Audit báo cáo tài chính 2024",
    department: "Phòng Tài chính - Kế toán",
    status: "Planning",
    progress: 30,
  },
];

async function seedProjects() {
  try {
    console.log("🌱 Starting project seeding...");

    const [depts]: any = await dbPool.query(
      "SELECT id, name FROM departments WHERE deleted_at IS NULL"
    );
    const deptMap = new Map();
    depts.forEach((d: any) => deptMap.set(d.name, d.id));

    const [users]: any = await dbPool.query(
      "SELECT id FROM users WHERE role IN ('Admin', 'Manager') LIMIT 1"
    );
    const managerId = users[0]?.id;

    let created = 0;
    for (const proj of projects) {
      const deptId = deptMap.get(proj.department);
      if (!deptId) {
        console.log(`⚠️  Department not found: ${proj.department}`);
        continue;
      }

      const projectId = crypto.randomUUID();
      const startDate = new Date(2024, 10, 1); // Nov 1, 2024
      const endDate = new Date(2025, 2, 31); // Mar 31, 2025

      await dbPool.query(
        `INSERT INTO projects (
          id, code, name, description, department_id, manager_id, 
          start_date, end_date, status, progress,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          projectId,
          proj.code,
          proj.name,
          `Dự án ${proj.name} thuộc ${proj.department}`,
          deptId,
          managerId,
          startDate,
          endDate,
          proj.status,
          proj.progress,
        ]
      );

      created++;
      console.log(`✅ Created: ${proj.name} - ${proj.department}`);
    }

    console.log(`\n🎉 Successfully created ${created} projects!`);
  } catch (error) {
    console.error("❌ Error seeding projects:", error);
  } finally {
    process.exit(0);
  }
}

seedProjects();
