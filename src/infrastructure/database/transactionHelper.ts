/**
 * Transaction Helper
 * 
 * Provides utilities for managing database transactions with automatic rollback on failure.
 * 
 * Requirements: 12.3 - Database operations fail with transaction rollback and meaningful error messages
 * 
 * Property 20: Transaction Rollback on Failure
 * For any database operation that fails mid-transaction, all changes made within that 
 * transaction should be rolled back, leaving the database in its pre-transaction state.
 */

import { Pool, PoolConnection } from "mysql2/promise";
import { dbPool } from "./connection.js";
import { createLogger } from "../logging/index.js";

const logger = createLogger("TransactionHelper");

/**
 * Transaction context passed to the callback function
 */
export interface TransactionContext {
  connection: PoolConnection;
  query: <T>(sql: string, params?: any[]) => Promise<T>;
}

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /** Custom pool to use (defaults to dbPool) */
  pool?: Pool;
  /** Timeout in milliseconds for acquiring a connection */
  acquireTimeout?: number;
  /** Whether to log transaction lifecycle events */
  logEvents?: boolean;
}

/**
 * Result of a transaction execution
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  rolledBack: boolean;
}

/**
 * Execute a function within a database transaction.
 * 
 * This function:
 * 1. Acquires a connection from the pool
 * 2. Begins a transaction
 * 3. Executes the provided callback with the transaction context
 * 4. Commits on success or rolls back on failure
 * 5. Always releases the connection back to the pool
 * 
 * @param callback - Async function to execute within the transaction
 * @param options - Optional configuration for the transaction
 * @returns The result of the callback function
 * @throws Error if the transaction fails (after rollback)
 * 
 * @example
 * ```typescript
 * const result = await withTransaction(async (ctx) => {
 *   await ctx.query('INSERT INTO users (name) VALUES (?)', ['John']);
 *   await ctx.query('INSERT INTO profiles (user_id) VALUES (?)', [userId]);
 *   return { userId };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const pool = options.pool || dbPool;
  const logEvents = options.logEvents ?? false;
  
  let connection: PoolConnection | null = null;
  let transactionStarted = false;
  
  try {
    // Acquire connection from pool
    connection = await pool.getConnection();
    
    if (logEvents) {
      logger.debug("Transaction: Connection acquired");
    }
    
    // Begin transaction
    await connection.beginTransaction();
    transactionStarted = true;
    
    if (logEvents) {
      logger.debug("Transaction: Started");
    }
    
    // Create transaction context with helper query function
    const ctx: TransactionContext = {
      connection,
      query: async <T>(sql: string, params?: any[]): Promise<T> => {
        const [result] = await connection!.query(sql, params);
        return result as T;
      },
    };
    
    // Execute the callback
    const result = await callback(ctx);
    
    // Commit transaction
    await connection.commit();
    
    if (logEvents) {
      logger.debug("Transaction: Committed successfully");
    }
    
    return result;
  } catch (error) {
    // Rollback on any error
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
        logger.warn("Transaction: Rolled back due to error", { 
          error: (error as Error).message 
        });
      } catch (rollbackError) {
        logger.error("Transaction: Rollback failed", rollbackError as Error);
      }
    }
    
    // Re-throw the original error
    throw error;
  } finally {
    // Always release the connection
    if (connection) {
      connection.release();
      
      if (logEvents) {
        logger.debug("Transaction: Connection released");
      }
    }
  }
}

/**
 * Execute a function within a transaction and return a detailed result object.
 * Unlike `withTransaction`, this function does not throw on failure but returns
 * a result object indicating success/failure status.
 * 
 * @param callback - Async function to execute within the transaction
 * @param options - Optional configuration for the transaction
 * @returns TransactionResult object with success status and data/error
 * 
 * @example
 * ```typescript
 * const result = await executeTransaction(async (ctx) => {
 *   await ctx.query('INSERT INTO users (name) VALUES (?)', ['John']);
 *   return { success: true };
 * });
 * 
 * if (!result.success) {
 *   console.error('Transaction failed:', result.error);
 *   console.log('Rolled back:', result.rolledBack);
 * }
 * ```
 */
export async function executeTransaction<T>(
  callback: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {}
): Promise<TransactionResult<T>> {
  const pool = options.pool || dbPool;
  const logEvents = options.logEvents ?? false;
  
  let connection: PoolConnection | null = null;
  let transactionStarted = false;
  let rolledBack = false;
  
  try {
    // Acquire connection from pool
    connection = await pool.getConnection();
    
    if (logEvents) {
      logger.debug("Transaction: Connection acquired");
    }
    
    // Begin transaction
    await connection.beginTransaction();
    transactionStarted = true;
    
    if (logEvents) {
      logger.debug("Transaction: Started");
    }
    
    // Create transaction context
    const ctx: TransactionContext = {
      connection,
      query: async <T>(sql: string, params?: any[]): Promise<T> => {
        const [result] = await connection!.query(sql, params);
        return result as T;
      },
    };
    
    // Execute the callback
    const data = await callback(ctx);
    
    // Commit transaction
    await connection.commit();
    
    if (logEvents) {
      logger.debug("Transaction: Committed successfully");
    }
    
    return {
      success: true,
      data,
      rolledBack: false,
    };
  } catch (error) {
    // Rollback on any error
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
        rolledBack = true;
        logger.warn("Transaction: Rolled back due to error", { 
          error: (error as Error).message 
        });
      } catch (rollbackError) {
        logger.error("Transaction: Rollback failed", rollbackError as Error);
      }
    }
    
    return {
      success: false,
      error: error as Error,
      rolledBack,
    };
  } finally {
    // Always release the connection
    if (connection) {
      connection.release();
      
      if (logEvents) {
        logger.debug("Transaction: Connection released");
      }
    }
  }
}

/**
 * Execute multiple operations in a single transaction.
 * All operations must succeed for the transaction to commit.
 * 
 * @param operations - Array of async functions to execute
 * @param options - Optional configuration for the transaction
 * @returns Array of results from each operation
 * 
 * @example
 * ```typescript
 * const results = await batchTransaction([
 *   (ctx) => ctx.query('INSERT INTO users (name) VALUES (?)', ['John']),
 *   (ctx) => ctx.query('INSERT INTO users (name) VALUES (?)', ['Jane']),
 * ]);
 * ```
 */
export async function batchTransaction<T>(
  operations: Array<(ctx: TransactionContext) => Promise<T>>,
  options: TransactionOptions = {}
): Promise<T[]> {
  return withTransaction(async (ctx) => {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation(ctx);
      results.push(result);
    }
    
    return results;
  }, options);
}

/**
 * Decorator-style function to wrap a repository method with transaction support.
 * Useful for adding transaction support to existing methods.
 * 
 * @param fn - The function to wrap
 * @param options - Optional configuration for the transaction
 * @returns A new function that executes within a transaction
 * 
 * @example
 * ```typescript
 * const createUserWithProfile = transactional(
 *   async (ctx, userData) => {
 *     const userId = await createUser(ctx, userData);
 *     await createProfile(ctx, userId);
 *     return userId;
 *   }
 * );
 * ```
 */
export function transactional<TArgs extends any[], TResult>(
  fn: (ctx: TransactionContext, ...args: TArgs) => Promise<TResult>,
  options: TransactionOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => {
    return withTransaction((ctx) => fn(ctx, ...args), options);
  };
}
