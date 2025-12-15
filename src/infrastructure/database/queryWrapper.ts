/**
 * Database Query Wrapper
 * 
 * Provides a wrapper around database queries to track performance metrics.
 * Logs slow queries for optimization.
 * 
 * Requirements: 5.5 - WHEN database queries exceed performance thresholds 
 * THEN the Nexus_System SHALL log query details for optimization
 */

import { Pool, PoolConnection, QueryResult, RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2/promise';
import { metricsService } from '../metrics/index.js';

/**
 * Execute a query with performance tracking
 * 
 * @param pool - The database pool or connection
 * @param sql - The SQL query string
 * @param values - Query parameters
 * @returns Query result
 */
export async function trackedQuery<T extends QueryResult>(
  pool: Pool | PoolConnection,
  sql: string,
  values?: any[]
): Promise<[T, FieldPacket[]]> {
  const startTime = process.hrtime.bigint();
  
  try {
    const result = await pool.query<T>(sql, values);
    
    // Calculate duration
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    // Record the metric
    metricsService.recordQuery(sql, durationMs);
    
    return result;
  } catch (error) {
    // Still record the metric even on failure
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    metricsService.recordQuery(sql, durationMs);
    
    throw error;
  }
}

/**
 * Execute a query and return rows with performance tracking
 */
export async function trackedQueryRows<T extends RowDataPacket[]>(
  pool: Pool | PoolConnection,
  sql: string,
  values?: any[]
): Promise<T> {
  const [rows] = await trackedQuery<T>(pool, sql, values);
  return rows;
}

/**
 * Execute an insert/update/delete query with performance tracking
 */
export async function trackedExecute(
  pool: Pool | PoolConnection,
  sql: string,
  values?: any[]
): Promise<ResultSetHeader> {
  const [result] = await trackedQuery<ResultSetHeader>(pool, sql, values);
  return result;
}

/**
 * Create a tracked pool wrapper that automatically tracks all queries
 * 
 * This creates a proxy around the pool that intercepts query calls
 * and adds performance tracking.
 */
export function createTrackedPool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, prop) {
      if (prop === 'query') {
        return async function(sql: string, values?: any[]) {
          return trackedQuery(target, sql, values);
        };
      }
      return (target as any)[prop];
    }
  });
}

export default {
  trackedQuery,
  trackedQueryRows,
  trackedExecute,
  createTrackedPool,
};
