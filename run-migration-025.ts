/**
 * Migration runner for 025_add_task_blocking_fields
 * Adds blocking fields to tasks table for task blocking workflow
 * Requirements: 8.4 - Task blocking reason requirement
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
    console.log('Running migration 025_add_task_blocking_fields...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/025_add_task_blocking_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(sql);
    
    console.log('Migration 025_add_task_blocking_fields completed successfully!');
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist, migration may have been run before.');
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
