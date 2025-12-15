import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const resetAdminPassword = async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'MiHoang151199@',
        database: 'nexus_db'
    });

    try {
        const newPassword = 'admin123';
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password_hash = ? WHERE email = ?',
            [passwordHash, 'admin@nexus.com']
        );

        console.log('✅ Admin password reset successfully!');
        console.log('📧 Email: admin@nexus.com');
        console.log('🔑 Password: admin123');

        // Verify the hash works
        const [users] = await connection.query(
            'SELECT password_hash FROM users WHERE email = ?',
            ['admin@nexus.com']
        ) as any;

        if (users.length > 0) {
            const isValid = await bcrypt.compare(newPassword, users[0].password_hash);
            console.log('✔️  Password verification:', isValid ? 'SUCCESS' : 'FAILED');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
};

resetAdminPassword();
