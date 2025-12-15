/**
 * Migration 031: Add Performance Indexes
 * 
 * Requirements: 6.2 (Query Optimization)
 * 
 * This migration adds missing indexes to optimize query performance.
 * Run with: npx ts-node run-migration-031.ts
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
    console.log('Running migration 031: Add Performance Indexes...');
    
    const migrationPath = path.join(__dirname, 'src/infrastructure/database/migrations/031_add_performance_indexes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const statement of statements) {
      // Skip comments and empty lines
      if (statement.startsWith('--') || statement.trim() === '') continue;
      
      // Extract index name for logging
      const indexMatch = statement.match(/CREATE INDEX (\w+)/i);
      const indexName = indexMatch ? indexMatch[1] : 'unknown';
      
      try {
        await connection.query(statement);
        console.log(`  ✓ Created index: ${indexName}`);
        successCount++;
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`  - Skipped (already exists): ${indexName}`);
          skipCount++;
        } else {
          console.error(`  ✗ Failed to create index ${indexName}:`, error.message);
        }
      }
    }
    
    console.log(`\nMigration 031 completed!`);
    console.log(`  Created: ${successCount} indexes`);
    console.log(`  Skipped: ${skipCount} indexes (already exist)`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
