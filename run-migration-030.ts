/**
 * Migration Runner: 030_create_decision_records
 * 
 * Run with: npx ts-node run-migration-030.ts
 * 
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
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
    console.log('Running migration 030_create_decision_records...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/030_create_decision_records.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(migrationSQL);
    
    console.log('Migration 030 completed successfully!');
    console.log('Created decision_records table');
    console.log('Created decision_comment_links table');
  } catch (error: any) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('Tables already exist, skipping...');
    } else {
      console.error('Migration failed:', error.message);
      throw error;
    }
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
