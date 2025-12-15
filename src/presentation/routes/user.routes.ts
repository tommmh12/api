import { Router } from "express";
import * as UserController from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  userIdParamSchema,
} from "../../application/validators/schemas/index.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get all users
 *     description: Returns all users (admin/manager only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by department
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, employee]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of users
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags:
 *       - Users
 *     summary: Create new user
 *     description: Create a new user (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *               - departmentId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Must meet complexity requirements
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, manager, employee]
 *               departmentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: User created successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get("/", UserController.getAllUsers);
router.post("/", validate(createUserSchema), UserController.createUser);

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user profile
 *     description: Returns the current authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   put:
 *     tags:
 *       - Users
 *     summary: Update current user profile
 *     description: Update the current authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/profile", UserController.getProfile);
router.put("/profile", validate(updateProfileSchema), UserController.updateProfile);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user by ID
 *     description: Returns a single user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user
 *     description: Update user details (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, manager, employee]
 *               departmentId:
 *                 type: string
 *                 format: uuid
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
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
 *       - Users
 *     summary: Delete user
 *     description: Delete a user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/:id", validate(userIdParamSchema), UserController.getUserById);
router.put("/:id", validate(updateUserSchema), UserController.updateUser);
router.delete("/:id", validate(userIdParamSchema), UserController.deleteUser);

export default router;
