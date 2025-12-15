/**
 * Metrics Module
 * 
 * Exports metrics collection utilities for application observability.
 * 
 * Requirements: 5.2, 5.3, 5.5
 */

export {
  MetricsService,
  metricsService,
  type ResponseMetric,
  type QueryMetric,
  type MetricsSummary,
  type MetricsConfig,
} from './MetricsService.js';

export {
  ResourceMonitorService,
  resourceMonitorService,
  type ResourceMetrics,
  type ResourceThresholds,
  type ResourceAlert,
} from './ResourceMonitorService.js';

export {
  ErrorRateMonitorService,
  errorRateMonitorService,
  type ErrorRateMetrics,
  type ErrorRateThresholds,
  type ErrorRateAlert,
  type ErrorEntry,
} from './ErrorRateMonitorService.js';
