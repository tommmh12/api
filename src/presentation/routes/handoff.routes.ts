/**
 * Handoff Routes
 * API endpoints for cross-department task handoffs
 * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
 * Requirements: 9.4 - Handoff rejection with reason requirement
 * Requirements: 9.5 - Track handoff cycle time and rejection rate
 */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  acceptHandoffSchema,
  rejectHandoffSchema,
  getHandoffByIdSchema,
  getHandoffsByDepartmentSchema,
} from "../../application/validators/schemas/index.js";
import * as HandoffController from "../controllers/HandoffController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/handoffs/analytics/cycle-time:
 *   get:
 *     tags:
 *       - Handoff Analytics
 *     summary: Get handoff cycle time analytics
 *     description: |
 *       Returns analytics on handoff cycle time (time from initiation to response).
 *       (Requirements 9.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated after this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated before this date
 *       - in: query
 *         name: fromDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by originating department
 *       - in: query
 *         name: toDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by receiving department
 *     responses:
 *       200:
 *         description: Cycle time analytics
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
 *                     averageCycleTimeHours:
 *                       type: number
 *                       example: 12.5
 *                     minCycleTimeHours:
 *                       type: number
 *                       example: 0.5
 *                     maxCycleTimeHours:
 *                       type: number
 *                       example: 72.0
 *                     totalCompleted:
 *                       type: integer
 *                       example: 45
 *                     cycleTimeByDepartmentPair:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fromDepartmentId:
 *                             type: string
 *                           fromDepartmentName:
 *                             type: string
 *                           toDepartmentId:
 *                             type: string
 *                           toDepartmentName:
 *                             type: string
 *                           averageCycleTimeHours:
 *                             type: number
 *                           count:
 *                             type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/analytics/cycle-time", HandoffController.getCycleTimeAnalytics);

/**
 * @openapi
 * /api/handoffs/analytics/rejection-rate:
 *   get:
 *     tags:
 *       - Handoff Analytics
 *     summary: Get handoff rejection rate analytics
 *     description: |
 *       Returns analytics on handoff rejection rates per department pair.
 *       (Requirements 9.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated after this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated before this date
 *       - in: query
 *         name: fromDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by originating department
 *       - in: query
 *         name: toDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by receiving department
 *     responses:
 *       200:
 *         description: Rejection rate analytics
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
 *                     overallRejectionRate:
 *                       type: number
 *                       example: 8.5
 *                     totalHandoffs:
 *                       type: integer
 *                       example: 100
 *                     totalRejected:
 *                       type: integer
 *                       example: 8
 *                     totalAccepted:
 *                       type: integer
 *                       example: 86
 *                     totalPending:
 *                       type: integer
 *                       example: 6
 *                     rejectionRateByDepartmentPair:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fromDepartmentId:
 *                             type: string
 *                           fromDepartmentName:
 *                             type: string
 *                           toDepartmentId:
 *                             type: string
 *                           toDepartmentName:
 *                             type: string
 *                           totalHandoffs:
 *                             type: integer
 *                           rejectedCount:
 *                             type: integer
 *                           acceptedCount:
 *                             type: integer
 *                           rejectionRate:
 *                             type: number
 *                     topRejectionReasons:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           reason:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/analytics/rejection-rate", HandoffController.getRejectionRateAnalytics);

/**
 * @openapi
 * /api/handoffs/analytics/efficiency:
 *   get:
 *     tags:
 *       - Handoff Analytics
 *     summary: Get comprehensive handoff efficiency report
 *     description: |
 *       Returns a comprehensive report combining cycle time and rejection rate analytics
 *       with a health score and recommendations.
 *       (Requirements 9.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated after this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter handoffs initiated before this date
 *       - in: query
 *         name: fromDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by originating department
 *       - in: query
 *         name: toDepartmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by receiving department
 *     responses:
 *       200:
 *         description: Efficiency report
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
 *                     cycleTime:
 *                       type: object
 *                       description: Cycle time analytics
 *                     rejectionRate:
 *                       type: object
 *                       description: Rejection rate analytics
 *                     summary:
 *                       type: object
 *                       properties:
 *                         healthScore:
 *                           type: integer
 *                           minimum: 0
 *                           maximum: 100
 *                           example: 85
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/analytics/efficiency", HandoffController.getEfficiencyReport);

/**
 * @openapi
 * /api/handoffs/{id}:
 *   get:
 *     tags:
 *       - Handoffs
 *     summary: Get handoff by ID
 *     description: Returns a single handoff record with its details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Handoff ID
 *     responses:
 *       200:
 *         description: Handoff details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Handoff'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id", validate(getHandoffByIdSchema), HandoffController.getHandoffById);

/**
 * @openapi
 * /api/handoffs/{id}/accept:
 *   post:
 *     tags:
 *       - Handoffs
 *     summary: Accept handoff
 *     description: Accept a pending handoff (Requirements 9.1)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Handoff ID
 *     responses:
 *       200:
 *         description: Handoff accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Handoff accepted successfully
 *                 data:
 *                   $ref: '#/components/schemas/Handoff'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/accept", validate(acceptHandoffSchema), HandoffController.acceptHandoff);

/**
 * @openapi
 * /api/handoffs/{id}/reject:
 *   post:
 *     tags:
 *       - Handoffs
 *     summary: Reject handoff
 *     description: |
 *       Reject a pending handoff with a required reason.
 *       (Requirements 9.4)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Handoff ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 minLength: 1
 *                 description: Reason for rejecting the handoff
 *     responses:
 *       200:
 *         description: Handoff rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Handoff rejected
 *                 data:
 *                   $ref: '#/components/schemas/Handoff'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/reject", validate(rejectHandoffSchema), HandoffController.rejectHandoff);

/**
 * @openapi
 * /api/handoffs/department/{departmentId}:
 *   get:
 *     tags:
 *       - Handoffs
 *     summary: Get handoffs by department
 *     description: Returns all handoffs for a specific department (incoming and outgoing)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Department ID
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [incoming, outgoing, all]
 *           default: all
 *         description: Filter by handoff direction
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected]
 *         description: Filter by handoff status
 *     responses:
 *       200:
 *         description: List of handoffs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Handoff'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/department/:departmentId", validate(getHandoffsByDepartmentSchema), HandoffController.getHandoffsByDepartment);

export default router;
