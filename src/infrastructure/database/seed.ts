import bcrypt from "bcryptjs";
import { createConnection } from "./connection.js";

interface Department {
  id: string;
  name: string;
  description: string;
}

interface SeedUser {
  id: string;
  employee_id: string;
  email: string;
  password: string;
  full_name: string;
  phone: string;
  department_id: string;
  position: string;
  role: "Admin" | "Manager" | "Employee";
  avatar_url?: string;
}

const departments: Department[] = [
  {
    id: crypto.randomUUID(),
    name: "Phòng Công nghệ thông tin",
    description: "Quản lý hệ thống và phát triển phần mềm",
  },
  {
    id: crypto.randomUUID(),
    name: "Phòng Nhân sự",
    description: "Quản lý nhân sự và đào tạo",
  },
  {
    id: crypto.randomUUID(),
    name: "Phòng Tài chính - Kế toán",
    description: "Quản lý tài chính và kế toán",
  },
  {
    id: crypto.randomUUID(),
    name: "Phòng Marketing",
    description: "Marketing và truyền thông",
  },
];

const seedUsers: SeedUser[] = [
  {
    id: crypto.randomUUID(),
    employee_id: "NX001",
    email: "admin@nexus.com",
    password: "admin123",
    full_name: "Quản trị viên hệ thống",
    phone: "0901234567",
    department_id: departments[0].id, // IT
    position: "System Administrator",
    role: "Admin",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  },
  {
    id: crypto.randomUUID(),
    employee_id: "NX002",
    email: "nguyenvana@nexus.com",
    password: "123456",
    full_name: "Nguyễn Văn A",
    phone: "0902345678",
    department_id: departments[0].id, // IT
    position: "Senior Developer",
    role: "Manager",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=nguyenvana",
  },
  {
    id: crypto.randomUUID(),
    employee_id: "NX003",
    email: "tranthib@nexus.com",
    password: "123456",
    full_name: "Trần Thị B",
    phone: "0903456789",
    department_id: departments[1].id, // HR
    position: "HR Manager",
    role: "Manager",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=tranthib",
  },
  {
    id: crypto.randomUUID(),
    employee_id: "NX004",
    email: "levanc@nexus.com",
    password: "123456",
    full_name: "Lê Văn C",
    phone: "0904567890",
    department_id: departments[2].id, // Finance
    position: "Accountant",
    role: "Employee",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=levanc",
  },
  {
    id: crypto.randomUUID(),
    employee_id: "NX005",
    email: "phamthid@nexus.com",
    password: "123456",
    full_name: "Phạm Thị D",
    phone: "0905678901",
    department_id: departments[3].id, // Marketing
    position: "Marketing Specialist",
    role: "Employee",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=phamthid",
  },
];

async function seed() {
  let connection;

  try {
    console.log("🌱 Starting database seeding...\n");

    connection = await createConnection();

    // Seed Departments
    console.log("📂 Seeding departments...");
    for (const dept of departments) {
      await connection.execute(
        `INSERT INTO departments (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [dept.id, dept.name, dept.description]
      );
      console.log(`   ✓ ${dept.name}`);
    }

    // Seed Users
    console.log("\n👥 Seeding users...");
    for (const user of seedUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      await connection.execute(
        `INSERT INTO users (
          id, employee_id, email, password_hash, full_name, phone,
          department_id, position, role, status, avatar_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE email = VALUES(email)`,
        [
          user.id,
          user.employee_id,
          user.email,
          passwordHash,
          user.full_name,
          user.phone,
          user.department_id,
          user.position,
          user.role,
          user.avatar_url,
        ]
      );
      console.log(
        `   ✓ ${user.full_name} (${user.email}) - Password: ${user.password}`
      );
    }

    console.log("\n========================================");
    console.log("✅ Database seeding completed!");
    console.log("========================================");
    console.log("\n📝 Test Accounts:");
    console.log("   Admin: admin@nexus.com / admin123");
    console.log("   Manager (IT): nguyenvana@nexus.com / 123456");
    console.log("   Manager (HR): tranthib@nexus.com / 123456");
    console.log("   Employee (Finance): levanc@nexus.com / 123456");
    console.log("   Employee (Marketing): phamthid@nexus.com / 123456");
    console.log("========================================\n");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();
