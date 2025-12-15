/**
 * Checklist Analytics Routes
 * API endpoints for checklist analytics
 * Requirements: 11.5 - Track completion time and frequently skipped items
 */

import { Router } from "express";
import { ChecklistAnalyticsController } from "../controllers/ChecklistAnalyticsController.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @openapi
 * /api/analytics/checklist/completion-time:
 *   get:
 *     tags:
 *       - Checklist Analytics
 *     summary: Get checklist completion time analytics
 *     description: |
 *       Returns analytics on checklist item completion time (time from creation to completion).
 *       (Requirements 11.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering analytics
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering analytics
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by project ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department ID
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by task ID
 *     responses:
 *       200:
 *         description: Completion time analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     averageCompletionTimeHours:
 *                       type: number
 *                       description: Average time to complete checklist items in hours
 *                     minCompletionTimeHours:
 *                       type: number
 *                       description: Minimum completion time in hours
 *                     maxCompletionTimeHours:
 *                       type: number
 *                       description: Maximum completion time in hours
 *                     totalCompleted:
 *                       type: integer
 *                       description: Total number of completed checklist items
 *                     completionTimeByTask:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           taskId:
 *                             type: string
 *                           taskTitle:
 *                             type: string
 *                           averageCompletionTimeHours:
 *                             type: number
 *                           itemsCompleted:
 *                             type: integer
 *                     completionTimeByDepartment:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           departmentId:
 *                             type: string
 *                           departmentName:
 *                             type: string
 *                           averageCompletionTimeHours:
 *                             type: number
 *                           itemsCompleted:
 *                             type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/completion-time", ChecklistAnalyticsController.getCompletionTimeAnalytics);

/**
 * @openapi
 * /api/analytics/checklist/skipped-items:
 *   get:
 *     tags:
 *       - Checklist Analytics
 *     summary: Get frequently skipped items analytics
 *     description: |
 *       Returns analytics on checklist items that are frequently skipped (unchecked after being checked).
 *       (Requirements 11.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering analytics
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering analytics
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by project ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department ID
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by task ID
 *     responses:
 *       200:
 *         description: Skipped items analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSkippedItems:
 *                       type: integer
 *                       description: Total number of skipped checklist items
 *                     totalMandatorySkipped:
 *                       type: integer
 *                       description: Number of mandatory items that were skipped
 *                     skippedRate:
 *                       type: number
 *                       description: Percentage of items that were skipped
 *                     frequentlySkippedItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemText:
 *                             type: string
 *                           taskId:
 *                             type: string
 *                           taskTitle:
 *                             type: string
 *                           skipCount:
 *                             type: integer
 *                           isMandatory:
 *                             type: boolean
 *                           lastSkippedAt:
 *                             type: string
 *                             format: date-time
 *                     skippedByDepartment:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           departmentId:
 *                             type: string
 *                           departmentName:
 *                             type: string
 *                           skippedCount:
 *                             type: integer
 *                           mandatorySkippedCount:
 *                             type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/skipped-items", ChecklistAnalyticsController.getSkippedItemsAnalytics);

/**
 * @openapi
 * /api/analytics/checklist/efficiency:
 *   get:
 *     tags:
 *       - Checklist Analytics
 *     summary: Get comprehensive checklist efficiency report
 *     description: |
 *       Returns a comprehensive report combining completion time and skipped items analytics
 *       with a health score and recommendations.
 *       (Requirements 11.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering analytics
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering analytics
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by project ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department ID
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by task ID
 *     responses:
 *       200:
 *         description: Checklist efficiency report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     completionTime:
 *                       type: object
 *                       description: Completion time analytics
 *                     skippedItems:
 *                       type: object
 *                       description: Skipped items analytics
 *                     summary:
 *                       type: object
 *                       properties:
 *                         healthScore:
 *                           type: integer
 *                           description: Overall health score (0-100)
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: List of recommendations based on analytics
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/efficiency", ChecklistAnalyticsController.getEfficiencyReport);

export default router;
