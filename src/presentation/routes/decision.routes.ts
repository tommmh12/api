/**
 * Decision Record Routes
 * API endpoints for decision documentation
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
 */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createDecisionSchema,
  updateDecisionSchema,
  reviseDecisionSchema,
  approveDecisionSchema,
  submitDecisionSchema,
  getDecisionByIdSchema,
  searchDecisionsSchema,
  getDecisionHistorySchema,
  linkDecisionToCommentSchema,
  unlinkDecisionFromCommentSchema,
  deleteDecisionSchema,
} from "../../application/validators/schemas/index.js";
import * as DecisionController from "../controllers/DecisionRecordController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/decisions/search:
 *   get:
 *     tags:
 *       - Decisions
 *     summary: Search decision records
 *     description: Search across decision records with filtering (Requirements 10.3)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query for title, context, decision, or rationale
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_approval, approved, superseded]
 *         description: Filter by status
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by project
 *     responses:
 *       200:
 *         description: Search results
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
 *                     $ref: '#/components/schemas/DecisionRecord'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/search", validate(searchDecisionsSchema), DecisionController.searchDecisions);

/**
 * @openapi
 * /api/decisions:
 *   post:
 *     tags:
 *       - Decisions
 *     summary: Create decision record
 *     description: |
 *       Create a new decision record with context, decision, and rationale.
 *       (Requirements 10.1)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - context
 *               - decision
 *               - rationale
 *             properties:
 *               title:
 *                 type: string
 *                 description: Decision title
 *               projectId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated project ID
 *               taskId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated task ID
 *               context:
 *                 type: string
 *                 description: Background and problem statement
 *               decision:
 *                 type: string
 *                 description: What was decided
 *               rationale:
 *                 type: string
 *                 description: Why this decision was made
 *               optionsConsidered:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     pros:
 *                       type: array
 *                       items:
 *                         type: string
 *                     cons:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: Decision record created
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
 *                   example: Decision record created successfully
 *                 data:
 *                   $ref: '#/components/schemas/DecisionRecord'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", validate(createDecisionSchema), DecisionController.createDecision);

/**
 * @openapi
 * /api/decisions/{id}:
 *   get:
 *     tags:
 *       - Decisions
 *     summary: Get decision by ID
 *     description: Returns a single decision record with its details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     responses:
 *       200:
 *         description: Decision record details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DecisionRecord'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Decisions
 *     summary: Update decision record
 *     description: Update a decision record (only DRAFT status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               context:
 *                 type: string
 *               decision:
 *                 type: string
 *               rationale:
 *                 type: string
 *     responses:
 *       200:
 *         description: Decision record updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Decisions
 *     summary: Delete decision record
 *     description: Delete a decision record (only DRAFT status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     responses:
 *       200:
 *         description: Decision record deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id", validate(getDecisionByIdSchema), DecisionController.getDecisionById);
router.put("/:id", validate(updateDecisionSchema), DecisionController.updateDecision);
router.delete("/:id", validate(deleteDecisionSchema), DecisionController.deleteDecision);

/**
 * @openapi
 * /api/decisions/{id}/submit:
 *   post:
 *     tags:
 *       - Decisions
 *     summary: Submit decision for approval
 *     description: Submit a draft decision for approval
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     responses:
 *       200:
 *         description: Decision submitted for approval
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/submit", validate(submitDecisionSchema), DecisionController.submitDecisionForApproval);

/**
 * @openapi
 * /api/decisions/{id}/approve:
 *   post:
 *     tags:
 *       - Decisions
 *     summary: Approve decision record
 *     description: Approve a pending decision record (Requirements 10.2)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     responses:
 *       200:
 *         description: Decision approved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/approve", validate(approveDecisionSchema), DecisionController.approveDecision);

/**
 * @openapi
 * /api/decisions/{id}/revise:
 *   post:
 *     tags:
 *       - Decisions
 *     summary: Revise decision record
 *     description: |
 *       Create a new version of a decision record.
 *       Original decision history is preserved (Requirements 10.5)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Decision record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: string
 *               decision:
 *                 type: string
 *               rationale:
 *                 type: string
 *     responses:
 *       201:
 *         description: New decision version created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DecisionRecord'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/revise", validate(reviseDecisionSchema), DecisionController.reviseDecision);

// Version history
// GET /api/decisions/:id/history - Get decision version history
router.get("/:id/history", validate(getDecisionHistorySchema), DecisionController.getDecisionHistory);

// Comment linking
// GET /api/decisions/:id/linked-comments - Get linked comment IDs
router.get("/:id/linked-comments", validate(getDecisionByIdSchema), DecisionController.getLinkedComments);

// POST /api/decisions/:id/link-comment - Link decision to comment
// Requirements: 10.4 - Link between comment and decision record
router.post("/:id/link-comment", validate(linkDecisionToCommentSchema), DecisionController.linkDecisionToComment);

// DELETE /api/decisions/:id/link-comment/:commentId - Unlink decision from comment
router.delete("/:id/link-comment/:commentId", validate(unlinkDecisionFromCommentSchema), DecisionController.unlinkDecisionFromComment);

export default router;
