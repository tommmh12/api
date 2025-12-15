import mysql from 'mysql2/promise';
import dotenv from 'dotenv';


dotenv.config();

const seedFloors = async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'nexus_db'
    });

    try {
        console.log('Clearing existing floors...');
        await connection.execute('DELETE FROM floor_plans'); // Optional: clear old data if any

        console.log('Seeding floors...');
        const floors = [
            { floor_number: 10, name: 'Tầng 10 - Khu Công nghệ' },
            { floor_number: 11, name: 'Tầng 11 - Khu Hành chính' },
            { floor_number: 12, name: 'Tầng 12 - Khu VIP' }
        ];

        for (const floor of floors) {
            await connection.execute(
                'INSERT INTO floor_plans (id, floor_number, name, is_active) VALUES (UUID(), ?, ?, ?)',
                [floor.floor_number, floor.name, true]
            );
        }

        console.log('✅ Floors seeded successfully!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await connection.end();
    }
};

seedFloors();
