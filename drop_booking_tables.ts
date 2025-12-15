import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dropTables = async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'nexus_db'
    });

    try {
        console.log('Dropping booking tables...');

        // Order matters for foreign keys
        // booking_participants -> room_bookings -> meeting_rooms -> floor_plans
        await connection.execute('DROP TABLE IF EXISTS booking_participants');
        await connection.execute('DROP TABLE IF EXISTS room_bookings');

        // Clean up old tables
        await connection.execute('DROP TABLE IF EXISTS booking_attendees');
        await connection.execute('DROP TABLE IF EXISTS meeting_bookings');

        await connection.execute('DROP TABLE IF EXISTS meeting_rooms');
        await connection.execute('DROP TABLE IF EXISTS floor_plans');

        console.log('✅ Tables dropped successfully!');

    } catch (error) {
        console.error('❌ Drop failed:', error);
    } finally {
        await connection.end();
    }
};

dropTables();
