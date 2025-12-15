import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  addMemberSchema,
  removeMemberSchema,
  getDecisionsByProjectSchema,
} from "../../application/validators/schemas/index.js";
import * as ProjectController from "../controllers/ProjectController.js";
import * as DecisionController from "../controllers/DecisionRecordController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/projects/generate-code:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Generate unique project code
 *     description: Generates a unique project code in format PRJ-XXX
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Generated project code
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
 *                     code:
 *                       type: string
 *                       example: PRJ-042
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/generate-code", ProjectController.generateProjectCode);

/**
 * @openapi
 * /api/projects/my-projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get current user's projects
 *     description: Returns all projects where the current user is a member or manager
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's projects
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
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/my-projects", ProjectController.getMyProjects);

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get all projects
 *     description: Returns all projects (admin/manager) or user's projects (employee)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planning, in_progress, completed, on_hold, cancelled]
 *         description: Filter by project status
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department
 *     responses:
 *       200:
 *         description: List of projects
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
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   post:
 *     tags:
 *       - Projects
 *     summary: Create new project
 *     description: Create a new project. Requires manager or admin role.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProject'
 *     responses:
 *       201:
 *         description: Project created successfully
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
 *                   example: Project created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get("/", ProjectController.getProjects);
router.post("/", validate(createProjectSchema), ProjectController.createProject);

/**
 * @openapi
 * /api/projects/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get project by ID
 *     description: Returns a single project with its details and members
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Projects
 *     summary: Update project
 *     description: Update project details. Requires manager or admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProject'
 *     responses:
 *       200:
 *         description: Project updated successfully
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
 *                   example: Project updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Delete project
 *     description: Delete a project. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
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
 *                   example: Project deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id", validate(projectIdParamSchema), ProjectController.getProjectById);
router.put("/:id", validate(updateProjectSchema), ProjectController.updateProject);
router.delete("/:id", validate(projectIdParamSchema), ProjectController.deleteProject);

/**
 * @openapi
 * /api/projects/{id}/members:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Add member to project
 *     description: Add a user as a member to the project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to add as member
 *               role:
 *                 type: string
 *                 enum: [member, lead]
 *                 default: member
 *     responses:
 *       200:
 *         description: Member added successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post("/:id/members", validate(addMemberSchema), ProjectController.addMember);

/**
 * @openapi
 * /api/projects/{id}/members/{userId}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Remove member from project
 *     description: Remove a user from the project members
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete("/:id/members/:userId", validate(removeMemberSchema), ProjectController.removeMember);

/**
 * @openapi
 * /api/projects/{projectId}/decisions:
 *   get:
 *     tags:
 *       - Projects
 *       - Decisions
 *     summary: Get project decision records
 *     description: Returns all decision records associated with a project
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
 *     responses:
 *       200:
 *         description: List of decision records
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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:projectId/decisions", validate(getDecisionsByProjectSchema), DecisionController.getDecisionsByProject);

export default router;
