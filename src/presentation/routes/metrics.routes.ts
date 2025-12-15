/**
 * Metrics Routes
 * 
 * Exposes application metrics for monitoring and observability.
 * 
 * Requirements: 5.2, 5.3, 5.5
 */

import { Router, Request, Response } from 'express';
import { metricsService, resourceMonitorService, errorRateMonitorService } from '../../infrastructure/metrics/index.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';
import { alertSchedulerService } from '../../application/services/AlertSchedulerService.js';

const router = Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get application metrics summary
 *     description: Returns aggregated metrics including HTTP response times, status codes, and database query performance
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     http:
 *                       type: object
 *                       properties:
 *                         totalRequests:
 *                           type: number
 *                         requestsByStatus:
 *                           type: object
 *                         requestsByMethod:
 *                           type: object
 *                         averageResponseTimeMs:
 *                           type: number
 *                         p50ResponseTimeMs:
 *                           type: number
 *                         p95ResponseTimeMs:
 *                           type: number
 *                         p99ResponseTimeMs:
 *                           type: number
 *                         slowRequests:
 *                           type: number
 *                     database:
 *                       type: object
 *                       properties:
 *                         totalQueries:
 *                           type: number
 *                         averageQueryTimeMs:
 *                           type: number
 *                         slowQueries:
 *                           type: number
 *                         slowQueryThresholdMs:
 *                           type: number
 *                     uptime:
 *                       type: number
 *                     collectionStartTime:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const summary = metricsService.getSummary();
  
  res.json({
    success: true,
    data: summary,
  });
});

/**
 * @swagger
 * /metrics/slow-requests:
 *   get:
 *     summary: Get recent slow HTTP requests
 *     description: Returns the most recent slow HTTP requests that exceeded the threshold
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of slow requests to return
 *     responses:
 *       200:
 *         description: List of slow requests
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/slow-requests', authMiddleware, requireRole(['admin']), (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const slowRequests = metricsService.getSlowRequests(limit);
  
  res.json({
    success: true,
    data: slowRequests,
    count: slowRequests.length,
  });
});

/**
 * @swagger
 * /metrics/slow-queries:
 *   get:
 *     summary: Get recent slow database queries
 *     description: Returns the most recent slow database queries that exceeded the threshold
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of slow queries to return
 *     responses:
 *       200:
 *         description: List of slow queries
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/slow-queries', authMiddleware, requireRole(['admin']), (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const slowQueries = metricsService.getSlowQueries(limit);
  
  res.json({
    success: true,
    data: slowQueries,
    count: slowQueries.length,
  });
});

/**
 * @swagger
 * /metrics/config:
 *   get:
 *     summary: Get metrics configuration
 *     description: Returns the current metrics collection configuration
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics configuration
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/config', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const config = metricsService.getConfig();
  
  res.json({
    success: true,
    data: config,
  });
});

// ==================== RESOURCE MONITORING ENDPOINTS ====================
// Requirements: 5.3 - Resource threshold alerts

/**
 * @swagger
 * /metrics/resources:
 *   get:
 *     summary: Get current system resource metrics
 *     description: Returns current CPU, Memory, and Disk usage metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resource metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     cpu:
 *                       type: object
 *                       properties:
 *                         usagePercent:
 *                           type: number
 *                         loadAverage:
 *                           type: array
 *                           items:
 *                             type: number
 *                         cores:
 *                           type: number
 *                     memory:
 *                       type: object
 *                       properties:
 *                         totalBytes:
 *                           type: number
 *                         usedBytes:
 *                           type: number
 *                         freeBytes:
 *                           type: number
 *                         usagePercent:
 *                           type: number
 *                     disk:
 *                       type: object
 *                       properties:
 *                         totalBytes:
 *                           type: number
 *                         usedBytes:
 *                           type: number
 *                         freeBytes:
 *                           type: number
 *                         usagePercent:
 *                           type: number
 *                         path:
 *                           type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/resources', authMiddleware, requireRole(['admin']), async (_req: Request, res: Response) => {
  try {
    const metrics = await resourceMonitorService.collectMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to collect resource metrics',
    });
  }
});

/**
 * @swagger
 * /metrics/resources/thresholds:
 *   get:
 *     summary: Get resource alert thresholds
 *     description: Returns the current threshold configuration for resource alerts
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resource thresholds
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/resources/thresholds', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const thresholds = resourceMonitorService.getThresholds();
  
  res.json({
    success: true,
    data: thresholds,
  });
});

/**
 * @swagger
 * /metrics/resources/check:
 *   post:
 *     summary: Manually trigger resource threshold check
 *     description: Checks current resource usage against thresholds and returns any alerts
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resource check results
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/resources/check', authMiddleware, requireRole(['admin']), async (_req: Request, res: Response) => {
  try {
    const alerts = await alertSchedulerService.checkResourceThresholds();
    
    res.json({
      success: true,
      data: {
        alerts,
        alertCount: alerts.length,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check resource thresholds',
    });
  }
});

/**
 * @swagger
 * /metrics/resources/history:
 *   get:
 *     summary: Get resource metrics history
 *     description: Returns historical resource metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of history entries to return
 *     responses:
 *       200:
 *         description: Resource metrics history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/resources/history', authMiddleware, requireRole(['admin']), (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const history = resourceMonitorService.getHistory(limit);
  
  res.json({
    success: true,
    data: history,
    count: history.length,
  });
});

// ==================== ERROR RATE MONITORING ENDPOINTS ====================
// Requirements: 5.3 - Error rate alerts

/**
 * @swagger
 * /metrics/error-rate:
 *   get:
 *     summary: Get current error rate metrics
 *     description: Returns current error rate statistics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error rate metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: number
 *                     errorCount:
 *                       type: number
 *                     errorRate:
 *                       type: number
 *                     errorsByStatus:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/error-rate', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const metrics = errorRateMonitorService.getMetrics();
  
  res.json({
    success: true,
    data: metrics,
  });
});

/**
 * @swagger
 * /metrics/error-rate/thresholds:
 *   get:
 *     summary: Get error rate alert thresholds
 *     description: Returns the current threshold configuration for error rate alerts
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error rate thresholds
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/error-rate/thresholds', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const thresholds = errorRateMonitorService.getThresholds();
  
  res.json({
    success: true,
    data: thresholds,
  });
});

/**
 * @swagger
 * /metrics/error-rate/check:
 *   post:
 *     summary: Manually trigger error rate check
 *     description: Checks current error rate against thresholds and returns any alerts
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error rate check results
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/error-rate/check', authMiddleware, requireRole(['admin']), async (_req: Request, res: Response) => {
  try {
    const alert = await alertSchedulerService.checkErrorRate();
    
    res.json({
      success: true,
      data: {
        alert,
        hasAlert: alert !== null,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check error rate',
    });
  }
});

/**
 * @swagger
 * /metrics/error-rate/by-path:
 *   get:
 *     summary: Get error breakdown by path
 *     description: Returns error counts grouped by API endpoint path
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Errors by path
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/error-rate/by-path', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const errorsByPath = errorRateMonitorService.getErrorsByPath();
  
  res.json({
    success: true,
    data: errorsByPath,
  });
});

/**
 * @swagger
 * /metrics/error-rate/by-status:
 *   get:
 *     summary: Get error breakdown by status code
 *     description: Returns error counts grouped by HTTP status code
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Errors by status code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/error-rate/by-status', authMiddleware, requireRole(['admin']), (_req: Request, res: Response) => {
  const errorsByStatus = errorRateMonitorService.getErrorsByStatusCode();
  
  res.json({
    success: true,
    data: errorsByStatus,
  });
});

export default router;
