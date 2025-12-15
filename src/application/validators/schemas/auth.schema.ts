/**
 * Authentication Validation Schemas
 * 
 * Schemas for auth-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { emailSchema, safeStringSchema } from './common.schema.js';

/**
 * Login request schema
 * POST /api/auth/login
 */
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: safeStringSchema(1, 128),
    rememberMe: z.boolean().optional().default(false),
  }),
});

/**
 * Change password request schema
 * PUT /api/auth/change-password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: safeStringSchema(1, 128),
    newPassword: safeStringSchema(8, 128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
      ),
  }),
});

// Type exports for use in controllers
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
