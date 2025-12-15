import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../infrastructure/logging/index.js";

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly errors?: FieldError[];

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true,
    errors?: FieldError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.errors = errors;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Field-specific error for validation errors
 */
export interface FieldError {
  field: string;
  message: string;
  code: string;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: FieldError[];
  correlationId: string;
}

/**
 * Patterns that should be sanitized from error messages
 */
const SENSITIVE_PATTERNS = [
  // File paths (Windows and Unix)
  /[A-Za-z]:\\[^\s]+/g,
  /\/(?:home|var|usr|etc|opt|tmp|app|src|node_modules)[^\s]*/gi,
  // Database connection strings
  /mysql:\/\/[^\s]+/gi,
  /postgres:\/\/[^\s]+/gi,
  /mongodb:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,
  // Environment variables that might contain secrets
  /(?:password|secret|key|token|auth|credential)[=:][^\s]+/gi,
  // IP addresses (internal)
  /(?:192\.168|10\.|172\.(?:1[6-9]|2[0-9]|3[01]))\.\d+\.\d+/g,
  // Stack trace indicators
  /at\s+[^\s]+\s+\([^)]+\)/g,
  /at\s+[^\s]+\s+[^\s]+:\d+:\d+/g,
  // SQL query fragments that might reveal structure
  /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\s+[^\s]+/gi,
];

/**
 * Sanitizes error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  
  return sanitized;
}

/**
 * Checks if an error message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Gets user-friendly message based on error type
 */
function getUserFriendlyMessage(err: Error, statusCode: number): string {
  // If it's an operational error with a safe message, use it
  if (err instanceof AppError && err.isOperational) {
    // Still sanitize in case the message was constructed with user input
    const sanitized = sanitizeErrorMessage(err.message);
    if (!containsSensitiveInfo(sanitized)) {
      return sanitized;
    }
  }
  
  // Default messages based on status code
  switch (statusCode) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication required. Please log in to continue.";
    case 403:
      return "Access denied. You do not have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "A conflict occurred. The resource may have been modified.";
    case 422:
      return "Unable to process the request. Please verify your data.";
    case 429:
      return "Too many requests. Please try again later.";
    case 500:
    default:
      return "An unexpected error occurred. Please try again later.";
  }
}

/**
 * Determines the appropriate HTTP status code for an error
 */
function getStatusCode(err: Error): number {
  if (err instanceof AppError) {
    return err.statusCode;
  }
  
  // Handle common error types
  const errorName = err.name?.toLowerCase() || "";
  const errorMessage = err.message?.toLowerCase() || "";
  
  if (errorName.includes("validation") || errorMessage.includes("validation")) {
    return 400;
  }
  
  if (errorName.includes("unauthorized") || errorMessage.includes("unauthorized")) {
    return 401;
  }
  
  if (errorName.includes("forbidden") || errorMessage.includes("forbidden")) {
    return 403;
  }
  
  if (errorName.includes("notfound") || errorMessage.includes("not found")) {
    return 404;
  }
  
  // JWT errors
  if (errorName === "jsonwebtokenerror" || errorName === "tokenexpirederror") {
    return 401;
  }
  
  return 500;
}

/**
 * Gets the error code for the response
 */
function getErrorCode(err: Error, statusCode: number): string {
  if (err instanceof AppError) {
    return err.code;
  }
  
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}

/**
 * Logs error with full context for debugging (server-side only)
 * Uses structured logger with correlation ID for request tracing
 */
function logError(
  err: Error,
  req: Request,
  _correlationId: string,
  statusCode: number
): void {
  // Use request logger if available (has correlation ID), otherwise use default logger
  const reqLogger = req.logger || logger;
  
  const logContext = {
    error: {
      name: err.name,
      message: err.message,
      ...(err instanceof AppError && { code: err.code, isOperational: err.isOperational }),
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: Object.keys(req.params).length > 0 ? req.params : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      // Don't log body for sensitive endpoints
      body: isSensitiveEndpoint(req.path) ? "[REDACTED]" : req.body,
      ip: req.ip || req.socket?.remoteAddress,
    },
    user: (req as any).user ? {
      userId: (req as any).user.userId,
      email: (req as any).user.email,
    } : undefined,
    statusCode,
  };
  
  // Log based on severity using structured logger
  if (statusCode >= 500) {
    reqLogger.error("Request failed with server error", err, logContext);
  } else if (statusCode >= 400) {
    reqLogger.warn("Request failed with client error", logContext);
  }
}

/**
 * Checks if the endpoint is sensitive (auth-related)
 */
function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    /\/auth\//i,
    /\/login/i,
    /\/password/i,
    /\/register/i,
    /\/token/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(path));
}

/**
 * Global error handler middleware
 * 
 * This middleware catches all unhandled exceptions and:
 * 1. Logs full error context (stack, request data, user context) for debugging
 * 2. Returns sanitized user-friendly error response
 * 3. Never exposes stack traces, file paths, or internal details to clients
 * 
 * Requirements: 12.1
 */
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Generate correlation ID for tracking
  const correlationId = (req as any).correlationId || uuidv4();
  
  // Determine status code
  const statusCode = getStatusCode(err);
  
  // Log full error context (server-side)
  logError(err, req, correlationId, statusCode);
  
  // Build sanitized response
  const response: ErrorResponse = {
    success: false,
    message: getUserFriendlyMessage(err, statusCode),
    code: getErrorCode(err, statusCode),
    correlationId,
  };
  
  // Include field errors for validation errors (if they exist and are safe)
  if (err instanceof AppError && err.errors && err.errors.length > 0) {
    response.errors = err.errors.map(fieldError => ({
      field: fieldError.field,
      message: sanitizeErrorMessage(fieldError.message),
      code: fieldError.code,
    }));
  }
  
  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = (req as any).correlationId || uuidv4();
  
  res.status(404).json({
    success: false,
    message: "The requested resource was not found.",
    code: "NOT_FOUND",
    correlationId,
  });
};
