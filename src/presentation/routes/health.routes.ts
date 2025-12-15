import { Router, Request, Response } from 'express';
import { healthCheckService } from '../../application/services/HealthCheckService.js';

/**
 * Health Check Routes
 * 
 * Provides endpoints for monitoring system health.
 * Requirements: 4.4
 */

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Full system health check
 *     description: |
 *       Comprehensive health check that verifies:
 *       - Database connectivity and response time
 *       - File storage accessibility
 *       
 *       Returns structured health status with individual component checks.
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               success: true
 *               status: healthy
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               checks:
 *                 database:
 *                   name: database
 *                   status: up
 *                   responseTime: 15
 *                 fileStorage:
 *                   name: fileStorage
 *                   status: up
 *       503:
 *         description: System is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               success: false
 *               status: unhealthy
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               checks:
 *                 database:
 *                   name: database
 *                   status: down
 *                   lastError: "Connection refused"
 *                 fileStorage:
 *                   name: fileStorage
 *                   status: up
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const healthResult = await healthCheckService.check();
    
    // Return appropriate HTTP status based on health
    const statusCode = healthResult.status === 'healthy' ? 200 : 
                       healthResult.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthResult.status !== 'unhealthy',
      ...healthResult,
    });
  } catch (error) {
    // If health check itself fails, return 503
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: { name: 'database', status: 'down', lastError: 'Health check failed' },
        fileStorage: { name: 'fileStorage', status: 'down', lastError: 'Health check failed' },
      },
      error: error instanceof Error ? error.message : 'Unknown error during health check',
    });
  }
});

/**
 * @openapi
 * /health/database:
 *   get:
 *     tags:
 *       - Health
 *     summary: Database health check
 *     description: Check only database connectivity and response time
 *     security: []
 *     responses:
 *       200:
 *         description: Database is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 name:
 *                   type: string
 *                   example: database
 *                 status:
 *                   type: string
 *                   enum: [up, down, degraded]
 *                   example: up
 *                 responseTime:
 *                   type: number
 *                   example: 15
 *       503:
 *         description: Database is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 name:
 *                   type: string
 *                   example: database
 *                 status:
 *                   type: string
 *                   example: down
 *                 lastError:
 *                   type: string
 *                   example: Connection refused
 */
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await healthCheckService.checkComponent('database');
    const statusCode = dbHealth.status === 'up' ? 200 : 503;
    
    res.status(statusCode).json({
      success: dbHealth.status === 'up',
      ...dbHealth,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      name: 'database',
      status: 'down',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /health/storage:
 *   get:
 *     tags:
 *       - Health
 *     summary: File storage health check
 *     description: Check only file storage accessibility
 *     security: []
 *     responses:
 *       200:
 *         description: File storage is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 name:
 *                   type: string
 *                   example: fileStorage
 *                 status:
 *                   type: string
 *                   enum: [up, down, degraded]
 *                   example: up
 *       503:
 *         description: File storage is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 name:
 *                   type: string
 *                   example: fileStorage
 *                 status:
 *                   type: string
 *                   example: down
 *                 lastError:
 *                   type: string
 *                   example: Directory not accessible
 */
router.get('/storage', async (_req: Request, res: Response) => {
  try {
    const storageHealth = await healthCheckService.checkComponent('fileStorage');
    const statusCode = storageHealth.status === 'up' ? 200 : 503;
    
    res.status(statusCode).json({
      success: storageHealth.status === 'up',
      ...storageHealth,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      name: 'fileStorage',
      status: 'down',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
