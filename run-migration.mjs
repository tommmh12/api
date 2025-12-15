// Run migration: node run-migration.mjs
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '123456',
        database: 'nexus_db',
        multipleStatements: true
    });

    try {
        console.log('✅ Connected to MySQL');

        const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/014_add_task_status_id.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running migration: 014_add_task_status_id.sql');

        // Split by semicolon and run each statement
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.query(statement);
                    console.log('  ✓ Executed:', statement.substring(0, 50) + '...');
                } catch (error) {
                    // Ignore "column already exists" or "constraint already exists" errors
                    if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
                        console.log('  ⚠ Already exists, skipping:', statement.substring(0, 50) + '...');
                    } else {
                        throw error;
                    }
                }
            }
        }

        console.log('\n🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await connection.end();
    }
}

runMigration();
