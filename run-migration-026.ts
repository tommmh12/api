/**
 * Migration runner for 026_create_task_dependencies
 * Creates task_dependencies table for tracking task dependencies
 * Requirements: 8.3 - Task dependency relationships and conflict warnings
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexus_db',
    multipleStatements: true
  });

  try {
    console.log('Running migration 026_create_task_dependencies...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/026_create_task_dependencies.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(sql);
    
    console.log('Migration 026_create_task_dependencies completed successfully!');
  } catch (error: any) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('Table already exists, migration may have been run before.');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('Index or constraint already exists, migration may have been run before.');
    } else {
      console.error('Migration failed:', error.message);
      throw error;
    }
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
