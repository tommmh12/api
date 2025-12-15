/**
 * Migration runner for 022_create_token_blacklist
 * 
 * Run with: npx ts-node run-migration-022.ts
 * 
 * Requirements 1.3: Token invalidation mechanism
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexus_db',
    multipleStatements: true,
  });

  try {
    console.log('Running migration 022_create_token_blacklist...');
    
    const migrationPath = path.join(
      __dirname, 
      'src/infrastructure/database/migrations/022_create_token_blacklist.sql'
    );
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(migrationSQL);
    
    console.log('Migration 022_create_token_blacklist completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
