/**
 * Metrics Service
 * 
 * Collects and exposes application metrics for monitoring and observability.
 * Tracks response times, status codes, and database query performance.
 * 
 * Requirements: 5.2, 5.5
 */

import { logger } from '../logging/index.js';

export interface ResponseMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
}

export interface QueryMetric {
  query: string;
  durationMs: number;
  timestamp: Date;
  slow: boolean;
}

export interface MetricsSummary {
  http: {
    totalRequests: number;
    requestsByStatus: Record<string, number>;
    requestsByMethod: Record<string, number>;
    averageResponseTimeMs: number;
    p50ResponseTimeMs: number;
    p95ResponseTimeMs: number;
    p99ResponseTimeMs: number;
    slowRequests: number;
  };
  database: {
    totalQueries: number;
    averageQueryTimeMs: number;
    slowQueries: number;
    slowQueryThresholdMs: number;
  };
  uptime: number;
  collectionStartTime: Date;
}

export interface MetricsConfig {
  httpSlowRequestThresholdMs: number;
  dbSlowQueryThresholdMs: number;
  maxStoredMetrics: number;
  enableDetailedLogging: boolean;
}

const DEFAULT_CONFIG: MetricsConfig = {
  httpSlowRequestThresholdMs: 1000,  // 1 second
  dbSlowQueryThresholdMs: 500,       // 500ms
  maxStoredMetrics: 10000,           // Keep last 10k metrics in memory
  enableDetailedLogging: false,
};


/**
 * MetricsService class
 * 
 * Singleton service that collects and aggregates application metrics.
 * Provides methods to record HTTP response metrics and database query metrics.
 */
export class MetricsService {
  private static instance: MetricsService;
  
  private config: MetricsConfig;
  private responseMetrics: ResponseMetric[] = [];
  private queryMetrics: QueryMetric[] = [];
  private startTime: Date;
  
  private constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
    
    // Load config from environment
    if (process.env.METRICS_HTTP_SLOW_THRESHOLD_MS) {
      this.config.httpSlowRequestThresholdMs = Number(process.env.METRICS_HTTP_SLOW_THRESHOLD_MS);
    }
    if (process.env.METRICS_DB_SLOW_THRESHOLD_MS) {
      this.config.dbSlowQueryThresholdMs = Number(process.env.METRICS_DB_SLOW_THRESHOLD_MS);
    }
    if (process.env.METRICS_DETAILED_LOGGING === 'true') {
      this.config.enableDetailedLogging = true;
    }
  }
  
  /**
   * Get the singleton instance of MetricsService
   */
  static getInstance(config?: Partial<MetricsConfig>): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService(config);
    }
    return MetricsService.instance;
  }
  
  /**
   * Record an HTTP response metric
   * Requirements: 5.2
   */
  recordResponse(metric: Omit<ResponseMetric, 'timestamp'>): void {
    const fullMetric: ResponseMetric = {
      ...metric,
      timestamp: new Date(),
    };
    
    this.responseMetrics.push(fullMetric);
    
    // Trim old metrics if we exceed the limit
    if (this.responseMetrics.length > this.config.maxStoredMetrics) {
      this.responseMetrics = this.responseMetrics.slice(-this.config.maxStoredMetrics);
    }
    
    // Log slow requests
    const isSlow = metric.responseTimeMs > this.config.httpSlowRequestThresholdMs;
    if (isSlow || this.config.enableDetailedLogging) {
      logger.info('HTTP request completed', {
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode,
        responseTimeMs: metric.responseTimeMs,
        slow: isSlow,
      });
    }
  }
  
  /**
   * Record a database query metric
   * Requirements: 5.5
   */
  recordQuery(query: string, durationMs: number): void {
    const isSlow = durationMs > this.config.dbSlowQueryThresholdMs;
    
    const metric: QueryMetric = {
      query: this.sanitizeQuery(query),
      durationMs,
      timestamp: new Date(),
      slow: isSlow,
    };
    
    this.queryMetrics.push(metric);
    
    // Trim old metrics if we exceed the limit
    if (this.queryMetrics.length > this.config.maxStoredMetrics) {
      this.queryMetrics = this.queryMetrics.slice(-this.config.maxStoredMetrics);
    }
    
    // Log slow queries for optimization
    // Requirements: 5.5 - log query details when exceeding performance thresholds
    if (isSlow) {
      logger.warn('Slow database query detected', {
        query: metric.query,
        durationMs,
        thresholdMs: this.config.dbSlowQueryThresholdMs,
      });
    }
  }
  
  /**
   * Sanitize query to remove sensitive data
   */
  private sanitizeQuery(query: string): string {
    // Truncate long queries and remove potential sensitive values
    const truncated = query.length > 200 ? query.substring(0, 200) + '...' : query;
    // Replace string literals with placeholders
    return truncated.replace(/'[^']*'/g, "'?'");
  }
  
  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }
  
  /**
   * Get aggregated metrics summary
   */
  getSummary(): MetricsSummary {
    const responseTimes = this.responseMetrics.map(m => m.responseTimeMs).sort((a, b) => a - b);
    const queryTimes = this.queryMetrics.map(m => m.durationMs);
    
    // Count requests by status code
    const requestsByStatus: Record<string, number> = {};
    const requestsByMethod: Record<string, number> = {};
    
    for (const metric of this.responseMetrics) {
      const statusGroup = `${Math.floor(metric.statusCode / 100)}xx`;
      requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1;
      requestsByMethod[metric.method] = (requestsByMethod[metric.method] || 0) + 1;
    }
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const avgQueryTime = queryTimes.length > 0
      ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length
      : 0;
    
    const slowRequests = this.responseMetrics.filter(
      m => m.responseTimeMs > this.config.httpSlowRequestThresholdMs
    ).length;
    
    const slowQueries = this.queryMetrics.filter(m => m.slow).length;
    
    return {
      http: {
        totalRequests: this.responseMetrics.length,
        requestsByStatus,
        requestsByMethod,
        averageResponseTimeMs: Math.round(avgResponseTime * 100) / 100,
        p50ResponseTimeMs: this.percentile(responseTimes, 50),
        p95ResponseTimeMs: this.percentile(responseTimes, 95),
        p99ResponseTimeMs: this.percentile(responseTimes, 99),
        slowRequests,
      },
      database: {
        totalQueries: this.queryMetrics.length,
        averageQueryTimeMs: Math.round(avgQueryTime * 100) / 100,
        slowQueries,
        slowQueryThresholdMs: this.config.dbSlowQueryThresholdMs,
      },
      uptime: Date.now() - this.startTime.getTime(),
      collectionStartTime: this.startTime,
    };
  }
  
  /**
   * Get recent slow requests
   */
  getSlowRequests(limit: number = 10): ResponseMetric[] {
    return this.responseMetrics
      .filter(m => m.responseTimeMs > this.config.httpSlowRequestThresholdMs)
      .slice(-limit);
  }
  
  /**
   * Get recent slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetric[] {
    return this.queryMetrics
      .filter(m => m.slow)
      .slice(-limit);
  }
  
  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.responseMetrics = [];
    this.queryMetrics = [];
    this.startTime = new Date();
  }
  
  /**
   * Get current configuration
   */
  getConfig(): MetricsConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const metricsService = MetricsService.getInstance();

export default metricsService;
