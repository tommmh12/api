/**
 * Migration Runner: 024_create_task_status_history
 * 
 * Run this script to create the task_status_history table.
 * 
 * Usage: npx ts-node run-migration-024.ts
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexus_db',
    multipleStatements: true
  });

  try {
    console.log('Running migration 024_create_task_status_history...');
    
    const migrationPath = path.join(
      __dirname, 
      'src/infrastructure/database/migrations/024_create_task_status_history.sql'
    );
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(sql);
    
    console.log('Migration 024_create_task_status_history completed successfully!');
    console.log('Created table: task_status_history');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
