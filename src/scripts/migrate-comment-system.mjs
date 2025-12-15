import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const runMigration = async () => {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '123456',
        database: 'nexus_db',
        multipleStatements: true
    });

    try {
        console.log('📦 Running migration: 012_create_unified_comment_system.sql');

        const migrationPath = join(__dirname, '../infrastructure/database/migrations/012_create_unified_comment_system.sql');
        const sql = readFileSync(migrationPath, 'utf8');

        await connection.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('   - comments table created');
        console.log('   - comment_edit_history table created');
        console.log('   - comment_reactions table created');
        console.log('   - comment_mentions table created');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
};

runMigration().catch(err => {
    console.error(err);
    process.exit(1);
});
