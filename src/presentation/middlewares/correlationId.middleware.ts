/**
 * Correlation ID Middleware
 * 
 * Generates a unique correlation ID for each request and attaches it to the request object.
 * This ID is used for request tracing across all log entries.
 * 
 * Requirements: 5.1
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, StructuredLogger } from '../../infrastructure/logging/index.js';

// Extend Express Request to include correlation ID and logger
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      logger: StructuredLogger;
    }
  }
}

// Header name for correlation ID (can be passed from upstream services)
const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Middleware that generates or extracts correlation ID for request tracing
 * 
 * - If x-correlation-id header is present, uses that value
 * - Otherwise generates a new UUID
 * - Attaches correlation ID to request object
 * - Creates a request-scoped logger with the correlation ID
 * - Adds correlation ID to response headers for client tracking
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract existing correlation ID from header or generate new one
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
  
  // Attach to request object
  req.correlationId = correlationId;
  
  // Create request-scoped logger with correlation ID and request context
  req.logger = createLogger('nexus-api', correlationId).child({
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
  });
  
  // Add correlation ID to response headers for client tracking
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  
  // Log incoming request
  req.logger.info('Incoming request', {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
  });
  
  // Track response time and log on finish
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logContext = {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };
    
    if (res.statusCode >= 500) {
      req.logger.error('Request completed with server error', undefined, logContext);
    } else if (res.statusCode >= 400) {
      req.logger.warn('Request completed with client error', logContext);
    } else {
      req.logger.info('Request completed', logContext);
    }
  });
  
  next();
}

export default correlationIdMiddleware;
