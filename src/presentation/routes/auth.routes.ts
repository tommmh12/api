import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { createAuthRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { loginSchema, changePasswordSchema } from "../../application/validators/schemas/index.js";

const router = Router();
const authController = new AuthController();

// Create rate limiter for authentication endpoints
// Configured via RATE_LIMIT_AUTH_WINDOW_MS and RATE_LIMIT_AUTH_MAX_ATTEMPTS env vars
const authRateLimiter = createAuthRateLimiter();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     description: |
 *       Authenticate user with email and password. Returns JWT token on success.
 *       
 *       **Rate Limited**: 5 attempts per 15 minutes per IP address.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecureP@ss123
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token for authentication
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: |
 *       Invalidate the current JWT token. The token will be blacklisted and cannot be used again.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/logout", authController.logout);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user
 *     description: Returns the currently authenticated user's profile information.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
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
 */
router.get("/me", authController.me);

/**
 * @openapi
 * /api/auth/change-password:
 *   put:
 *     tags:
 *       - Authentication
 *     summary: Change user password
 *     description: |
 *       Change the current user's password. Requires current password verification.
 *       All existing tokens will be invalidated after password change.
 *       
 *       **Password Requirements**:
 *       - Minimum 8 characters
 *       - At least one uppercase letter
 *       - At least one lowercase letter
 *       - At least one digit
 *       - At least one special character
 *       
 *       **Rate Limited**: 5 attempts per 15 minutes per IP address.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password for verification
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password meeting complexity requirements
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                   example: Password changed successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.put("/change-password", authRateLimiter, validate(changePasswordSchema), authController.changePassword);

export default router;
