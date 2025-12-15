import { dbPool } from "../infrastructure/database/connection.js";

async function checkDepartments() {
  const [rows]: any = await dbPool.query(
    "SELECT id, name FROM departments WHERE deleted_at IS NULL"
  );
  console.log("📋 Departments in database:");
  rows.forEach((d: any) => console.log(`  - ${d.name} (${d.id})`));
  process.exit(0);
}

checkDepartments();
