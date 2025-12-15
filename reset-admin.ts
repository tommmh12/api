import { dbPool } from "./src/infrastructure/database/connection.js";
import bcrypt from "bcrypt";

async function resetAdmin() {
    try {
        const passwordHash = await bcrypt.hash("Nexus@2025", 10);
        const email = "admin@nexus.com";

        console.log("Updating password for:", email);

        const [result]: any = await dbPool.query(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            [passwordHash, email]
        );

        if (result.affectedRows === 0) {
            console.log("⚠️ User not found. Creating admin user...");
            const userId = crypto.randomUUID();
            await dbPool.query(
                `INSERT INTO users (id, employee_id, email, password_hash, full_name, role, status)
         VALUES (UUID(), 'ADMIN01', ?, ?, 'Administrator', 'Admin', 'Active')`,
                [email, passwordHash]
            );
            console.log("✅ Admin user created.");
        } else {
            console.log("✅ Password updated successfully.");
        }
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        process.exit(0);
    }
}

resetAdmin();
