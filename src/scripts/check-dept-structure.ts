import { dbPool } from "../infrastructure/database/connection.js";

async function checkStructure() {
  const [columns]: any = await dbPool.query("DESCRIBE departments");
  console.log("📋 Current departments table structure:");
  columns.forEach((col: any) => {
    console.log(
      `  - ${col.Field} (${col.Type}) ${
        col.Null === "YES" ? "NULL" : "NOT NULL"
      } ${col.Key ? `[${col.Key}]` : ""}`
    );
  });
  process.exit(0);
}

checkStructure();
