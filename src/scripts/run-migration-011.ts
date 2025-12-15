import fs from 'fs';
import path from 'path';
import { dbPool } from '../infrastructure/database/connection';

async function runMigration() {
    const migrationFile = path.join(__dirname, '../infrastructure/database/migrations/011_update_tasks_and_projects.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running migration 011...');

    // Split by semicolon to run multiple statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const connection = await dbPool.getConnection();

    try {
        for (const statement of statements) {
            // Skip empty or comment-only lines if split wasn't perfect
            if (!statement) continue;

            console.log('Executing:', statement.substring(0, 50) + '...');
            await connection.query(statement);
        }
        console.log('Migration 011 completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

runMigration();
