/**
 * Migration Runner: 028_add_checklist_audit_fields
 * 
 * Adds audit fields to task_checklist_items table and creates
 * checklist_state_history table for complete audit trail.
 * 
 * Requirements: 11.1 - Record who completed checklist item and when
 * Requirements: 11.3 - Log changes when item is unchecked after being checked
 * 
 * Usage: npx ts-node run-migration-028.ts
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
    console.log('Running migration 028_add_checklist_audit_fields...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/028_add_checklist_audit_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`Executing: ${statement.substring(0, 80)}...`);
          await connection.query(statement);
          console.log('✓ Success');
        } catch (error: any) {
          // Ignore "duplicate column" or "already exists" errors
          if (error.code === 'ER_DUP_FIELDNAME' || 
              error.code === 'ER_TABLE_EXISTS_ERROR' ||
              error.code === 'ER_DUP_KEYNAME') {
            console.log(`⚠ Skipped (already exists): ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Migration 028 completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
