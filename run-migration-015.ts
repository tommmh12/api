import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'nexus_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true // Important for running migration scripts
    });

    try {
        const migrationPath = path.join(process.cwd(), 'src/infrastructure/database/migrations/015_create_room_booking_tables.sql');
        console.log(`Reading migration file from: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Remove "USE nexus_db;" line as we are already connected to it, strict mode might complain
        // Actually, mysql2 with multipleStatements should handle it, but better safe.
        // Or just run it.

        console.log('Executing migration...');
        await pool.query(sql);

        console.log('✅ Migration executed successfully!');

        // Check if tables exist
        const [rows] = await pool.query("SHOW TABLES LIKE 'floor_plans'");
        console.log('Tables check:', rows);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
};

runMigration();
