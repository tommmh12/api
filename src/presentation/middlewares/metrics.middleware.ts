/**
 * Metrics Middleware
 * 
 * Records HTTP response time and status code metrics for all API requests.
 * 
 * Requirements: 5.2 - WHEN API endpoints are called THEN the Nexus_System 
 * SHALL record response time and status code metrics
 * Requirements: 5.3 - Error rate tracking for alerting
 */

import { Request, Response, NextFunction } from 'express';
import { metricsService, errorRateMonitorService } from '../../infrastructure/metrics/index.js';

/**
 * Normalize path to group similar routes together
 * Replaces UUIDs and numeric IDs with placeholders
 */
function normalizePath(path: string): string {
  // Replace UUIDs
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  
  // Replace numeric IDs in path segments
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');
  
  return normalized;
}

/**
 * Middleware to record HTTP response metrics
 * 
 * Captures:
 * - HTTP method
 * - Request path (normalized)
 * - Response status code
 * - Response time in milliseconds
 * - Error tracking for 4xx and 5xx responses
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  
  // Use the 'finish' event to capture metrics after response is sent
  res.on('finish', () => {
    // Calculate response time
    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds
    const normalizedPath = normalizePath(req.path);
    
    // Record the metric
    metricsService.recordResponse({
      method: req.method,
      path: normalizedPath,
      statusCode: res.statusCode,
      responseTimeMs: Math.round(responseTimeMs * 100) / 100, // Round to 2 decimal places
    });

    // Record errors for error rate monitoring (4xx and 5xx responses)
    // Requirements: 5.3 - Error rate alerts
    if (res.statusCode >= 400) {
      errorRateMonitorService.recordError(res.statusCode, normalizedPath, req.method);
    }
  });
  
  next();
}

export default metricsMiddleware;
