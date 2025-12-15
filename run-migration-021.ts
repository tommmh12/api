import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'nexus_db',
    multipleStatements: true,
  });

  try {
    console.log('Running migration 021_create_security_audit_logs.sql...');
    
    const migrationPath = path.join(
      __dirname,
      'src/infrastructure/database/migrations/021_create_security_audit_logs.sql'
    );
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await connection.query(sql);
    
    console.log('✅ Migration 021 completed successfully!');
    console.log('Created table: security_audit_logs');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
