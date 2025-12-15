/**
 * Migration Runner: 029_add_checklist_mandatory_field
 * 
 * Run with: npx ts-node run-migration-029.ts
 * 
 * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

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
    console.log('Running migration 029_add_checklist_mandatory_field...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/029_add_checklist_mandatory_field.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(migrationSQL);
    
    console.log('Migration 029 completed successfully!');
    console.log('Added is_mandatory field to task_checklist_items table');
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column is_mandatory already exists, skipping...');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('Index idx_checklist_mandatory already exists, skipping...');
    } else {
      console.error('Migration failed:', error.message);
      throw error;
    }
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
