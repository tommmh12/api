import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigration() {
    console.log('🔄 Connecting to database...');

    const connection = await createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'nexus_db',
        multipleStatements: true // Allow multiple SQL statements
    });

    console.log('✅ Connected to database');

    try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'src', 'infrastructure', 'database', 'migrations', '016_create_online_meetings.sql');
        console.log('📄 Reading migration file:', migrationPath);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('⚡ Executing migration...');
        await connection.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify tables created
        console.log('\n🔍 Verifying tables...');
        const [tables] = await connection.query("SHOW TABLES LIKE 'online%'");
        console.log('Tables created:', tables);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await connection.end();
        console.log('👋 Database connection closed');
    }
}

runMigration()
    .then(() => {
        console.log('\n🎉 All done! You can now reload your web app.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Error:', error);
        process.exit(1);
    });
