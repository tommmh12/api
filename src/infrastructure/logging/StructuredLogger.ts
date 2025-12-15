/**
 * Structured Logger Utility
 * 
 * Provides JSON-formatted logging with correlation ID support for request tracing.
 * Supports log levels: DEBUG, INFO, WARN, ERROR
 * 
 * Requirements: 5.1
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId?: string;
  service: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  correlationId?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Get the configured log level from environment or default to INFO
 */
function getConfiguredLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel;
  }
  return 'INFO';
}

/**
 * Check if a log level should be output based on configured minimum level
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Sanitize context to remove sensitive data before logging
 */
function sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
  if (!context) return undefined;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'jwt'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Format error object for logging (without exposing stack in production)
 */
function formatError(error?: Error): LogEntry['error'] | undefined {
  if (!error) return undefined;
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    name: error.name,
    message: error.message,
    stack: isProduction ? undefined : error.stack,
  };
}

/**
 * Output log entry to appropriate stream
 */
function outputLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  
  if (entry.level === 'ERROR') {
    console.error(output);
  } else if (entry.level === 'WARN') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Structured Logger class
 * 
 * Creates JSON-formatted log entries with correlation ID support.
 * Use child() to create loggers with additional context.
 */
export class StructuredLogger {
  private service: string;
  private minLevel: LogLevel;
  private correlationId?: string;
  private additionalContext: Record<string, any>;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.minLevel = config.level || getConfiguredLogLevel();
    this.correlationId = config.correlationId;
    this.additionalContext = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): StructuredLogger {
    const childLogger = new StructuredLogger({
      service: this.service,
      level: this.minLevel,
      correlationId: this.correlationId,
    });
    childLogger.additionalContext = { ...this.additionalContext, ...context };
    return childLogger;
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(Object.keys(this.additionalContext).length > 0 || context) && {
        context: sanitizeContext({ ...this.additionalContext, ...context }),
      },
      ...(error && { error: formatError(error) }),
    };

    outputLog(entry);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('ERROR', message, context, error);
  }
}

/**
 * Default application logger instance
 */
export const logger = new StructuredLogger({
  service: 'nexus-api',
});

/**
 * Create a logger for a specific service/module
 */
export function createLogger(service: string, correlationId?: string): StructuredLogger {
  return new StructuredLogger({
    service,
    correlationId,
  });
}

export default logger;
