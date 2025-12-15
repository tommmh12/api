import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  getTasksByProjectSchema,
  taskIdParamSchema,
  addChecklistItemSchema,
  updateChecklistItemSchema,
  deleteChecklistItemSchema,
  getOwnershipEnforcementSchema,
  setOwnershipEnforcementSchema,
  validateOwnershipSchema,
  initiateHandoffSchema,
  getHandoffsByTaskSchema,
  getDecisionsByTaskSchema,
} from "../../application/validators/schemas/index.js";
import * as TaskController from "../controllers/TaskController.js";
import * as HandoffController from "../controllers/HandoffController.js";
import * as DecisionController from "../controllers/DecisionRecordController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/tasks/my-tasks:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get current user's tasks
 *     description: Returns all tasks assigned to or owned by the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's tasks
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
 *                     $ref: '#/components/schemas/Task'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/my-tasks", TaskController.getMyTasks);

/**
 * @openapi
 * /api/tasks/project/{projectId}:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get tasks by project
 *     description: Returns all tasks belonging to a specific project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in_progress, review, done, blocked]
 *         description: Filter by task status
 *     responses:
 *       200:
 *         description: List of project tasks
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
 *                     $ref: '#/components/schemas/Task'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/project/:projectId", validate(getTasksByProjectSchema), TaskController.getTasksByProject);

/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     tags:
 *       - Tasks
 *     summary: Get task by ID
 *     description: Returns a single task with its details, checklist, and dependencies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Tasks
 *     summary: Update task
 *     description: Update task details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTask'
 *     responses:
 *       200:
 *         description: Task updated successfully
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
 *                   example: Task updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Tasks
 *     summary: Delete task
 *     description: Delete a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id", validate(taskIdParamSchema), TaskController.getTaskById);
router.put("/:id", validate(updateTaskSchema), TaskController.updateTask);
router.delete("/:id", validate(taskIdParamSchema), TaskController.deleteTask);

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     tags:
 *       - Tasks
 *     summary: Create new task
 *     description: |
 *       Create a new task. Requires an owner to be assigned.
 *       
 *       **Requirements**: Task must have exactly one owner (Requirements 8.1)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTask'
 *     responses:
 *       201:
 *         description: Task created successfully
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
 *                   example: Task created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/", validate(createTaskSchema), TaskController.createTask);

router.post("/:id/checklist", validate(addChecklistItemSchema), TaskController.addChecklistItem);
router.put("/checklist/:itemId", validate(updateChecklistItemSchema), TaskController.updateChecklistItem);
router.delete("/checklist/:itemId", validate(deleteChecklistItemSchema), TaskController.deleteChecklistItem);

// Checklist State History (Requirements: 11.1, 11.3)
router.get("/:id/checklist/history", validate(taskIdParamSchema), TaskController.getChecklistStateHistory);
router.get("/checklist/:itemId/history", validate(deleteChecklistItemSchema), TaskController.getChecklistItemHistory);

/**
 * @openapi
 * /api/tasks/{id}/status:
 *   patch:
 *     tags:
 *       - Tasks
 *     summary: Update task status
 *     description: |
 *       Update task status (for workflow drag-drop).
 *       Status changes are recorded in history (Requirements 8.5).
 *       
 *       When changing to "blocked" status, a blocking reason is required (Requirements 8.4).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [todo, in_progress, review, done, blocked]
 *               blockedReason:
 *                 type: string
 *                 description: Required when status is "blocked"
 *               note:
 *                 type: string
 *                 description: Optional note for status change
 *     responses:
 *       200:
 *         description: Task status updated successfully
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
 *                   example: Task status updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch("/:id/status", validate(updateTaskStatusSchema), TaskController.updateTaskStatus);

// Task Status History (Requirements: 8.5)
router.get("/:id/history", validate(taskIdParamSchema), TaskController.getTaskStatusHistory);
router.get("/:id/with-history", validate(taskIdParamSchema), TaskController.getTaskWithHistory);
router.get("/status-changes/my", TaskController.getMyStatusChanges);

// Task Ownership Settings (Requirements: 8.1, 16.1, 16.6)
router.get("/ownership/settings", TaskController.getOwnershipSettings);
router.get("/ownership/enforcement/:departmentId", validate(getOwnershipEnforcementSchema), TaskController.getOwnershipEnforcementMode);
router.put("/ownership/enforcement/:departmentId", validate(setOwnershipEnforcementSchema), TaskController.setOwnershipEnforcementMode);
router.post("/ownership/validate", validate(validateOwnershipSchema), TaskController.validateTaskOwnership);

// Task Blocking (Requirements: 8.4)
router.post("/:id/block", validate(taskIdParamSchema), TaskController.blockTask);
router.post("/:id/unblock", validate(taskIdParamSchema), TaskController.unblockTask);
router.get("/project/:projectId/blocked", validate(getTasksByProjectSchema), TaskController.getBlockedTasks);
router.post("/blocking/validate", TaskController.validateBlockingReason);

// Task Dependencies (Requirements: 8.3)
router.get("/:id/dependencies", validate(taskIdParamSchema), TaskController.getTaskDependencies);
router.get("/:id/dependents", validate(taskIdParamSchema), TaskController.getTaskDependents);
router.post("/:id/dependencies", validate(taskIdParamSchema), TaskController.addTaskDependency);
router.delete("/:id/dependencies", validate(taskIdParamSchema), TaskController.removeTaskDependencyByTasks);
router.delete("/dependencies/:dependencyId", TaskController.removeTaskDependency);
router.post("/:id/dependencies/validate", validate(taskIdParamSchema), TaskController.validateTaskDependency);
router.post("/:id/dependencies/detect-cycle", validate(taskIdParamSchema), TaskController.detectCircularDependency);
router.get("/:id/dependencies/blocking-check", validate(taskIdParamSchema), TaskController.checkBlockingDependencies);
router.get("/project/:projectId/dependencies", validate(getTasksByProjectSchema), TaskController.getProjectDependencies);
router.get("/project/:projectId/dependency-graph", validate(getTasksByProjectSchema), TaskController.getDependencyGraph);

/**
 * @openapi
 * /api/tasks/{id}/handoff:
 *   post:
 *     tags:
 *       - Tasks
 *       - Handoffs
 *     summary: Initiate task handoff
 *     description: |
 *       Initiate a handoff of a task to another department.
 *       Creates a pending handoff record that must be accepted or rejected by the receiving department.
 *       (Requirements: 9.1, 9.4)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toDepartmentId
 *             properties:
 *               toDepartmentId:
 *                 type: string
 *                 format: uuid
 *                 description: Target department ID
 *               notes:
 *                 type: string
 *                 description: Handoff notes and context
 *               checklistCompleted:
 *                 type: boolean
 *                 description: Whether handoff checklist is completed
 *     responses:
 *       201:
 *         description: Handoff initiated successfully
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
 *                   example: Handoff initiated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Handoff'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/handoff", validate(initiateHandoffSchema), HandoffController.initiateHandoff);

/**
 * @openapi
 * /api/tasks/{id}/handoffs:
 *   get:
 *     tags:
 *       - Tasks
 *       - Handoffs
 *     summary: Get task handoff history
 *     description: Returns all handoff records for a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Task ID
 *     responses:
 *       200:
 *         description: List of handoff records
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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id/handoffs", validate(getHandoffsByTaskSchema), HandoffController.getHandoffsByTask);
router.get("/:id/handoff/latest", validate(taskIdParamSchema), HandoffController.getLatestHandoff);
router.get("/:id/handoff/pending", validate(taskIdParamSchema), HandoffController.checkPendingHandoff);

// Mandatory Checklist Validation (Requirements: 11.2)
router.get("/:id/mandatory-checklist/validate", validate(taskIdParamSchema), TaskController.validateMandatoryChecklist);
router.get("/:id/mandatory-checklist/uncompleted", validate(taskIdParamSchema), TaskController.getUncompletedMandatoryItems);
router.get("/mandatory-checklist/enforcement", TaskController.getMandatoryChecklistEnforcementMode);
router.put("/mandatory-checklist/enforcement", TaskController.setMandatoryChecklistEnforcementMode);

// Decision Records for Task (Requirements: 10.1)
router.get("/:taskId/decisions", validate(getDecisionsByTaskSchema), DecisionController.getDecisionsByTask);

export default router;
