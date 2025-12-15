import { dbPool } from "../infrastructure/database/connection.js";
import crypto from "crypto";
import bcrypt from "bcrypt";

const employees = [
  // Phòng Hành chính - 4 người
  {
    name: "Nguyễn Văn An",
    email: "nguyen.van.an@nexus.com",
    position: "Trưởng phòng HC",
    phone: "0901234501",
    deptName: "Phòng Hành chính",
  },
  {
    name: "Trần Thị Bình",
    email: "tran.thi.binh@nexus.com",
    position: "Phó phòng HC",
    phone: "0901234502",
    deptName: "Phòng Hành chính",
  },
  {
    name: "Lê Văn Cường",
    email: "le.van.cuong@nexus.com",
    position: "Nhân viên hành chính",
    phone: "0901234503",
    deptName: "Phòng Hành chính",
  },
  {
    name: "Phạm Thị Dung",
    email: "pham.thi.dung@nexus.com",
    position: "Thư ký",
    phone: "0901234504",
    deptName: "Phòng Hành chính",
  },

  // Phòng Kinh doanh - 4 người
  {
    name: "Hoàng Minh Đức",
    email: "hoang.minh.duc@nexus.com",
    position: "Trưởng phòng KD",
    phone: "0901234505",
    deptName: "Phòng Kinh doanh",
  },
  {
    name: "Đặng Thị Em",
    email: "dang.thi.em@nexus.com",
    position: "Trưởng nhóm Sales",
    phone: "0901234506",
    deptName: "Phòng Kinh doanh",
  },
  {
    name: "Vũ Văn Phong",
    email: "vu.van.phong@nexus.com",
    position: "Nhân viên kinh doanh",
    phone: "0901234507",
    deptName: "Phòng Kinh doanh",
  },
  {
    name: "Bùi Thị Giang",
    email: "bui.thi.giang@nexus.com",
    position: "Account Manager",
    phone: "0901234508",
    deptName: "Phòng Kinh doanh",
  },

  // Phòng Nhân sự - 3 người
  {
    name: "Nguyễn Thị Hoa",
    email: "nguyen.thi.hoa@nexus.com",
    position: "Trưởng phòng NS",
    phone: "0901234509",
    deptName: "Phòng Nhân sự",
  },
  {
    name: "Trần Văn Ích",
    email: "tran.van.ich@nexus.com",
    position: "HR Specialist",
    phone: "0901234510",
    deptName: "Phòng Nhân sự",
  },
  {
    name: "Lê Thị Khánh",
    email: "le.thi.khanh@nexus.com",
    position: "Recruitment Officer",
    phone: "0901234511",
    deptName: "Phòng Nhân sự",
  },

  // Phòng Marketing - 3 người
  {
    name: "Phạm Văn Lâm",
    email: "pham.van.lam@nexus.com",
    position: "Trưởng phòng MKT",
    phone: "0901234512",
    deptName: "Phòng Marketing",
  },
  {
    name: "Hoàng Thị Mai",
    email: "hoang.thi.mai@nexus.com",
    position: "Content Manager",
    phone: "0901234513",
    deptName: "Phòng Marketing",
  },
  {
    name: "Đặng Văn Nam",
    email: "dang.van.nam@nexus.com",
    position: "Social Media Specialist",
    phone: "0901234514",
    deptName: "Phòng Marketing",
  },

  // Phòng Tài chính - Kế toán - 3 người
  {
    name: "Vũ Thị Oanh",
    email: "vu.thi.oanh@nexus.com",
    position: "Trưởng phòng TC-KT",
    phone: "0901234515",
    deptName: "Phòng Tài chính - Kế toán",
  },
  {
    name: "Nguyễn Văn Phúc",
    email: "nguyen.van.phuc@nexus.com",
    position: "Kế toán trưởng",
    phone: "0901234516",
    deptName: "Phòng Tài chính - Kế toán",
  },
  {
    name: "Trần Thị Quỳnh",
    email: "tran.thi.quynh@nexus.com",
    position: "Kế toán viên",
    phone: "0901234517",
    deptName: "Phòng Tài chính - Kế toán",
  },

  // Phòng Công nghệ thông tin - 3 người
  {
    name: "Lê Văn Rồng",
    email: "le.van.rong@nexus.com",
    position: "Trưởng phòng IT",
    phone: "0901234518",
    deptName: "Phòng Công nghệ thông tin",
  },
  {
    name: "Phạm Minh Sáng",
    email: "pham.minh.sang@nexus.com",
    position: "Senior Developer",
    phone: "0901234519",
    deptName: "Phòng Công nghệ thông tin",
  },
  {
    name: "Hoàng Thị Tâm",
    email: "hoang.thi.tam@nexus.com",
    position: "DevOps Engineer",
    phone: "0901234520",
    deptName: "Phòng Công nghệ thông tin",
  },
];

async function seedEmployees() {
  try {
    console.log("🌱 Starting employee seeding...");

    // Get all departments
    const [depts]: any = await dbPool.query(
      "SELECT id, name FROM departments WHERE deleted_at IS NULL"
    );

    const deptMap = new Map();
    depts.forEach((d: any) => {
      deptMap.set(d.name, d.id);
    });

    console.log(`📁 Found ${depts.length} departments`);

    let created = 0;
    const defaultPassword = await bcrypt.hash("Nexus@2025", 10);

    for (const emp of employees) {
      const deptId = deptMap.get(emp.deptName);

      if (!deptId) {
        console.log(
          `⚠️  Department not found: ${emp.deptName}, skipping ${emp.name}`
        );
        continue;
      }

      // Check if user already exists
      const [existing]: any = await dbPool.query(
        "SELECT id FROM users WHERE email = ?",
        [emp.email]
      );

      if (existing.length > 0) {
        console.log(`⏭️  User already exists: ${emp.email}`);
        continue;
      }

      const userId = crypto.randomUUID();
      const employeeId = `NX${String(created + 1).padStart(4, "0")}`;

      await dbPool.query(
        `INSERT INTO users (
          id, employee_id, email, password_hash, full_name, phone,
          position, department_id, role, status, join_date,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          employeeId,
          emp.email,
          defaultPassword,
          emp.name,
          emp.phone,
          emp.position,
          deptId,
          "Employee",
          "Active",
          new Date(),
        ]
      );

      created++;
      console.log(`✅ Created: ${emp.name} (${emp.email}) - ${emp.deptName}`);
    }

    console.log(`\n🎉 Successfully created ${created} employees!`);
    console.log(`🔑 Default password for all: Nexus@2025`);
  } catch (error) {
    console.error("❌ Error seeding employees:", error);
  } finally {
    process.exit(0);
  }
}

seedEmployees();
