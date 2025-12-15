/**
 * Response Compression Middleware
 * 
 * Implements gzip compression for API responses to reduce bandwidth usage
 * and improve response times for clients.
 * 
 * Requirements: 7.1 - WHEN API responses exceed size thresholds THEN the 
 * Nexus_System SHALL apply compression
 */

import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Configuration for compression middleware
 */
interface CompressionConfig {
  /** Minimum response size in bytes to trigger compression (default: 1KB) */
  threshold?: number;
  /** Compression level (0-9, where 9 is maximum compression) */
  level?: number;
  /** Memory level for compression (1-9) */
  memLevel?: number;
}

/**
 * Filter function to determine if response should be compressed
 * Compresses JSON, text, and other compressible content types
 */
function shouldCompress(req: Request, res: Response): boolean {
  // Don't compress if client doesn't accept gzip
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Use default compression filter for content-type checking
  return compression.filter(req, res);
}

/**
 * Creates compression middleware with configurable options
 * 
 * @param config - Optional configuration for compression behavior
 * @returns Express middleware function
 */
export function createCompressionMiddleware(config: CompressionConfig = {}) {
  const {
    threshold = 1024, // 1KB minimum size to compress
    level = 6,        // Balanced compression level (1-9)
    memLevel = 8,     // Memory level for compression
  } = config;

  return compression({
    filter: shouldCompress,
    threshold,
    level,
    memLevel,
  });
}

/**
 * Default compression middleware instance
 * Uses sensible defaults for most API use cases:
 * - 1KB threshold (don't compress tiny responses)
 * - Level 6 compression (good balance of speed vs size)
 */
export const compressionMiddleware = createCompressionMiddleware();

export default compressionMiddleware;
