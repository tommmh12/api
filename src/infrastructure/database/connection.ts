import mysql, { Pool, PoolConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Re-export transaction helpers for convenience
export {
  withTransaction,
  executeTransaction,
  batchTransaction,
  transactional,
  type TransactionContext,
  type TransactionOptions,
  type TransactionResult,
} from "./transactionHelper.js";

// Re-export query wrapper for performance tracking
// Requirements: 5.5
export {
  trackedQuery,
  trackedQueryRows,
  trackedExecute,
  createTrackedPool,
} from "./queryWrapper.js";

/**
 * Database Pool Configuration
 * 
 * Environment variables:
 * - DB_POOL_MIN: Minimum connections to maintain (default: 2)
 * - DB_POOL_MAX: Maximum connections allowed (default: 10)
 * - DB_POOL_ACQUIRE_TIMEOUT: Time to wait for connection in ms (default: 30000)
 * - DB_POOL_IDLE_TIMEOUT: Time before idle connection is released in ms (default: 10000)
 */
export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  pendingRequests: number;
}

export interface PoolHealthCheckResult {
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  stats?: PoolStats;
}

// Default pool configuration
const DEFAULT_POOL_CONFIG: PoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  acquireTimeout: 30000,  // 30 seconds
  idleTimeout: 10000,     // 10 seconds
};

// Get pool configuration from environment variables
const getPoolConfig = (): PoolConfig => ({
  minConnections: Number(process.env.DB_POOL_MIN) || DEFAULT_POOL_CONFIG.minConnections,
  maxConnections: Number(process.env.DB_POOL_MAX) || DEFAULT_POOL_CONFIG.maxConnections,
  acquireTimeout: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT) || DEFAULT_POOL_CONFIG.acquireTimeout,
  idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT) || DEFAULT_POOL_CONFIG.idleTimeout,
});

export const createConnection = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "123456",
      database: process.env.DB_NAME || "nexus_db",
      charset: "utf8mb4",
    });

    console.log("✅ Database connected successfully");
    return connection;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};

export const createPool = (): Pool => {
  const config = getPoolConfig();
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "123456",
    database: process.env.DB_NAME || "nexus_db",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: config.maxConnections,
    queueLimit: 0,
    // Idle timeout - connections idle longer than this will be released
    idleTimeout: config.idleTimeout,
    // Enable keep-alive to detect stale connections
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10 seconds
  });

  console.log(`✅ Database pool created (min: ${config.minConnections}, max: ${config.maxConnections}, acquireTimeout: ${config.acquireTimeout}ms, idleTimeout: ${config.idleTimeout}ms)`);
  return pool;
};

export const dbPool = createPool();

/**
 * Get current pool statistics
 * Note: mysql2 pool doesn't expose all stats directly, so we access internal properties
 */
export const getPoolStats = (): PoolStats => {
  // Access internal pool properties (not part of public API but useful for monitoring)
  const pool = dbPool.pool as unknown as {
    _allConnections?: unknown[];
    _freeConnections?: unknown[];
    _connectionQueue?: unknown[];
  };
  
  return {
    totalConnections: pool._allConnections?.length ?? 0,
    idleConnections: pool._freeConnections?.length ?? 0,
    pendingRequests: pool._connectionQueue?.length ?? 0,
  };
};

/**
 * Perform a health check on the database connection pool
 * 
 * @returns PoolHealthCheckResult with health status and response time
 */
export const checkPoolHealth = async (): Promise<PoolHealthCheckResult> => {
  const startTime = Date.now();
  let connection: PoolConnection | null = null;
  
  try {
    // Try to get a connection from the pool
    connection = await dbPool.getConnection();
    
    // Execute a simple query to verify the connection works
    await connection.query('SELECT 1 as health_check');
    
    const responseTimeMs = Date.now() - startTime;
    const stats = getPoolStats();
    
    return {
      healthy: true,
      responseTimeMs,
      stats,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      healthy: false,
      responseTimeMs,
      error: errorMessage,
      stats: getPoolStats(),
    };
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Gracefully close the database pool
 * Should be called during application shutdown
 */
export const closePool = async (): Promise<void> => {
  try {
    await dbPool.end();
    console.log("✅ Database pool closed gracefully");
  } catch (error) {
    console.error("❌ Error closing database pool:", error);
    throw error;
  }
};
