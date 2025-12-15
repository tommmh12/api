/**
 * Error Rate Monitor Service
 * 
 * Monitors application error rates and provides metrics for alerting.
 * 
 * Requirements: 5.3 - Error rate alerts
 */

import { metricsService, MetricsSummary } from './MetricsService.js';
import { logger } from '../logging/index.js';

export interface ErrorRateMetrics {
  totalRequests: number;
  errorCount: number;
  errorRate: number;  // Percentage
  errorsByStatus: Record<string, number>;
  recentErrors: ErrorEntry[];
  timestamp: Date;
}

export interface ErrorEntry {
  statusCode: number;
  path: string;
  method: string;
  timestamp: Date;
}

export interface ErrorRateThresholds {
  warningPercent: number;
  criticalPercent: number;
  windowMinutes: number;
  minRequestsForAlert: number;
}

export interface ErrorRateAlert {
  level: 'warning' | 'critical';
  errorRate: number;
  threshold: number;
  totalRequests: number;
  errorCount: number;
  message: string;
  timestamp: Date;
}

const DEFAULT_THRESHOLDS: ErrorRateThresholds = {
  warningPercent: 5,      // 5% error rate triggers warning
  criticalPercent: 10,    // 10% error rate triggers critical
  windowMinutes: 15,      // Look at last 15 minutes
  minRequestsForAlert: 10, // Need at least 10 requests to trigger alert
};

/**
 * ErrorRateMonitorService class
 * 
 * Singleton service that monitors error rates and generates alerts
 * when thresholds are exceeded.
 */
export class ErrorRateMonitorService {
  private static instance: ErrorRateMonitorService;
  private thresholds: ErrorRateThresholds;
  private errorHistory: ErrorEntry[] = [];
  private maxHistorySize: number = 1000;

  private constructor(thresholds: Partial<ErrorRateThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    
    // Load thresholds from environment
    if (process.env.ERROR_RATE_WARNING_PERCENT) {
      this.thresholds.warningPercent = Number(process.env.ERROR_RATE_WARNING_PERCENT);
    }
    if (process.env.ERROR_RATE_CRITICAL_PERCENT) {
      this.thresholds.criticalPercent = Number(process.env.ERROR_RATE_CRITICAL_PERCENT);
    }
    if (process.env.ERROR_RATE_WINDOW_MINUTES) {
      this.thresholds.windowMinutes = Number(process.env.ERROR_RATE_WINDOW_MINUTES);
    }
    if (process.env.ERROR_RATE_MIN_REQUESTS) {
      this.thresholds.minRequestsForAlert = Number(process.env.ERROR_RATE_MIN_REQUESTS);
    }
  }

  /**
   * Get the singleton instance of ErrorRateMonitorService
   */
  static getInstance(thresholds?: Partial<ErrorRateThresholds>): ErrorRateMonitorService {
    if (!ErrorRateMonitorService.instance) {
      ErrorRateMonitorService.instance = new ErrorRateMonitorService(thresholds);
    }
    return ErrorRateMonitorService.instance;
  }

  /**
   * Record an error occurrence
   */
  recordError(statusCode: number, path: string, method: string): void {
    const entry: ErrorEntry = {
      statusCode,
      path,
      method,
      timestamp: new Date(),
    };

    this.errorHistory.push(entry);

    // Trim old entries
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get error rate metrics from the MetricsService
   */
  getMetrics(): ErrorRateMetrics {
    const summary: MetricsSummary = metricsService.getSummary();
    const totalRequests = summary.http.totalRequests;
    
    // Count errors (4xx and 5xx responses)
    const errorsByStatus: Record<string, number> = {};
    let errorCount = 0;

    for (const [status, count] of Object.entries(summary.http.requestsByStatus)) {
      if (status.startsWith('4') || status.startsWith('5')) {
        errorsByStatus[status] = count;
        errorCount += count;
      }
    }

    const errorRate = totalRequests > 0 
      ? Math.round((errorCount / totalRequests) * 100 * 100) / 100 
      : 0;

    // Get recent errors from history
    const windowStart = new Date(Date.now() - this.thresholds.windowMinutes * 60 * 1000);
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= windowStart);

    return {
      totalRequests,
      errorCount,
      errorRate,
      errorsByStatus,
      recentErrors,
      timestamp: new Date(),
    };
  }

  /**
   * Check error rate thresholds and return any alerts
   */
  checkThresholds(): ErrorRateAlert | null {
    const metrics = this.getMetrics();

    // Don't alert if we don't have enough requests
    if (metrics.totalRequests < this.thresholds.minRequestsForAlert) {
      return null;
    }

    // Check critical threshold first
    if (metrics.errorRate >= this.thresholds.criticalPercent) {
      const alert: ErrorRateAlert = {
        level: 'critical',
        errorRate: metrics.errorRate,
        threshold: this.thresholds.criticalPercent,
        totalRequests: metrics.totalRequests,
        errorCount: metrics.errorCount,
        message: `Error rate is critically high: ${metrics.errorRate}% (${metrics.errorCount}/${metrics.totalRequests} requests failed, threshold: ${this.thresholds.criticalPercent}%)`,
        timestamp: new Date(),
      };

      logger.warn('Critical error rate alert', {
        errorRate: metrics.errorRate,
        threshold: this.thresholds.criticalPercent,
        totalRequests: metrics.totalRequests,
        errorCount: metrics.errorCount,
      });

      return alert;
    }

    // Check warning threshold
    if (metrics.errorRate >= this.thresholds.warningPercent) {
      const alert: ErrorRateAlert = {
        level: 'warning',
        errorRate: metrics.errorRate,
        threshold: this.thresholds.warningPercent,
        totalRequests: metrics.totalRequests,
        errorCount: metrics.errorCount,
        message: `Error rate is high: ${metrics.errorRate}% (${metrics.errorCount}/${metrics.totalRequests} requests failed, threshold: ${this.thresholds.warningPercent}%)`,
        timestamp: new Date(),
      };

      logger.warn('Warning error rate alert', {
        errorRate: metrics.errorRate,
        threshold: this.thresholds.warningPercent,
        totalRequests: metrics.totalRequests,
        errorCount: metrics.errorCount,
      });

      return alert;
    }

    return null;
  }

  /**
   * Get error breakdown by path
   */
  getErrorsByPath(): Record<string, number> {
    const windowStart = new Date(Date.now() - this.thresholds.windowMinutes * 60 * 1000);
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= windowStart);

    const byPath: Record<string, number> = {};
    for (const error of recentErrors) {
      const key = `${error.method} ${error.path}`;
      byPath[key] = (byPath[key] || 0) + 1;
    }

    return byPath;
  }

  /**
   * Get error breakdown by status code
   */
  getErrorsByStatusCode(): Record<number, number> {
    const windowStart = new Date(Date.now() - this.thresholds.windowMinutes * 60 * 1000);
    const recentErrors = this.errorHistory.filter(e => e.timestamp >= windowStart);

    const byStatus: Record<number, number> = {};
    for (const error of recentErrors) {
      byStatus[error.statusCode] = (byStatus[error.statusCode] || 0) + 1;
    }

    return byStatus;
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ErrorRateThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<ErrorRateThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Reset error history (useful for testing)
   */
  reset(): void {
    this.errorHistory = [];
  }
}

// Export singleton instance
export const errorRateMonitorService = ErrorRateMonitorService.getInstance();

export default errorRateMonitorService;
