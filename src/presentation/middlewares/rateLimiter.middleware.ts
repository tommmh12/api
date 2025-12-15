import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Rate Limiter Middleware
 * 
 * Implements IP-based rate limiting to prevent brute force attacks on authentication endpoints.
 * 
 * **Feature: nexus-transformation-plan, Property 2: Rate Limiting Behavior**
 * For any sequence of N+1 authentication attempts from the same IP within the rate limit window,
 * the (N+1)th attempt should be rejected with HTTP 429 status regardless of credential validity.
 * 
 * **Validates: Requirements 1.2**
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

interface RateLimiterConfig {
  windowMs: number;        // Time window in milliseconds
  maxAttempts: number;     // Max attempts per window
  keyGenerator?: (req: Request) => string;  // How to identify client
}

// In-memory store for rate limit tracking
// Note: For production with multiple instances, consider using Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup(windowMs: number): void {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries that are outside the window and not blocked
      if (now - entry.firstAttempt > windowMs && (!entry.blockedUntil || now > entry.blockedUntil)) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  
  // Don't prevent process from exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return forwardedIp.trim();
  }
  
  // Fall back to direct IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Creates a rate limiter middleware with the specified configuration
 */
export function createRateLimiter(config: RateLimiterConfig): RequestHandler {
  const {
    windowMs,
    maxAttempts,
    keyGenerator = defaultKeyGenerator,
  } = config;

  // Start cleanup process
  startCleanup(windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    // Check if currently blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.setHeader('X-RateLimit-Limit', maxAttempts.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.blockedUntil / 1000).toString());
      
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      });
      return;
    }
    
    // Reset if window has passed
    if (!entry || (now - entry.firstAttempt > windowMs)) {
      entry = {
        count: 1,
        firstAttempt: now,
      };
      rateLimitStore.set(key, entry);
    } else {
      // Increment count within window
      entry.count++;
      
      // Check if limit exceeded
      if (entry.count > maxAttempts) {
        // Block until window expires
        entry.blockedUntil = entry.firstAttempt + windowMs;
        
        const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        res.setHeader('X-RateLimit-Limit', maxAttempts.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', Math.ceil(entry.blockedUntil / 1000).toString());
        
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        });
        return;
      }
    }
    
    // Set rate limit headers for successful requests
    const remaining = Math.max(0, maxAttempts - entry.count);
    const resetTime = Math.ceil((entry.firstAttempt + windowMs) / 1000);
    
    res.setHeader('X-RateLimit-Limit', maxAttempts.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());
    
    next();
  };
}

/**
 * Pre-configured rate limiter for authentication endpoints
 * 
 * Configuration via environment variables:
 * - RATE_LIMIT_AUTH_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - RATE_LIMIT_AUTH_MAX_ATTEMPTS: Max attempts per window (default: 5)
 */
export function createAuthRateLimiter(): RequestHandler {
  const windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10); // 15 minutes default
  const maxAttempts = parseInt(process.env.RATE_LIMIT_AUTH_MAX_ATTEMPTS || '5', 10);
  
  return createRateLimiter({
    windowMs,
    maxAttempts,
  });
}

/**
 * Reset rate limit for a specific key (useful for testing or admin actions)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for a key (useful for testing)
 */
export function getRateLimitStatus(key: string): RateLimitEntry | undefined {
  return rateLimitStore.get(key);
}

/**
 * Clear all rate limit entries (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

// Export the store for testing purposes
export { rateLimitStore };
