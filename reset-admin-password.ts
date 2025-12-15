import bcrypt from 'bcryptjs';
import { createConnection } from './src/infrastructure/database/connection.js';

const resetAdminPassword = async () => {
    let connection;

    try {
        connection = await createConnection();

        const newPassword = 'admin123';
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password_hash = ? WHERE email = ?',
            [passwordHash, 'admin@nexus.com']
        );

        console.log('========================================');
        console.log('✅ Admin password reset successfully!');
        console.log('========================================');
        console.log('📧 Email: admin@nexus.com');
        console.log('🔑 Password: admin123');
        console.log('========================================');

        // Verify the hash works
        const [users] = await connection.query(
            'SELECT password_hash FROM users WHERE email = ?',
            ['admin@nexus.com']
        ) as any;

        if (users.length > 0) {
            const isValid = await bcrypt.compare(newPassword, users[0].password_hash);
            console.log('✔️  Password verification:', isValid ? 'SUCCESS ✅' : 'FAILED ❌');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

resetAdminPassword();
