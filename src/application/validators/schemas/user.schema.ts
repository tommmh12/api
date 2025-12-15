/**
 * User Validation Schemas
 * 
 * Schemas for user-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, emailSchema, safeStringSchema, optionalSafeStringSchema } from './common.schema.js';

// User role enum
const userRoleSchema = z.enum(['admin', 'manager', 'employee']);

// User status enum
const userStatusSchema = z.enum(['active', 'inactive', 'pending']);

// Phone number validation (Vietnamese format or international)
const phoneSchema = z.string()
  .regex(/^(\+?84|0)?[0-9]{9,10}$/, 'Invalid phone number format')
  .optional()
  .nullable();

/**
 * Create user request schema
 * POST /api/users
 */
export const createUserSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: safeStringSchema(8, 128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
      ),
    fullName: safeStringSchema(1, 255),
    role: userRoleSchema.optional().default('employee'),
    departmentId: uuidSchema.optional().nullable(),
    phone: phoneSchema,
    position: optionalSafeStringSchema(100),
    status: userStatusSchema.optional().default('active'),
  }),
});

/**
 * Update user request schema
 * PUT /api/users/:id
 */
export const updateUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    email: emailSchema.optional(),
    fullName: safeStringSchema(1, 255).optional(),
    role: userRoleSchema.optional(),
    departmentId: uuidSchema.optional().nullable(),
    phone: phoneSchema,
    position: optionalSafeStringSchema(100),
    status: userStatusSchema.optional(),
    avatar: optionalSafeStringSchema(500),
  }),
});

/**
 * Update profile request schema
 * PUT /api/users/profile
 */
export const updateProfileSchema = z.object({
  body: z.object({
    fullName: safeStringSchema(1, 255).optional(),
    phone: phoneSchema,
    position: optionalSafeStringSchema(100),
    avatar: optionalSafeStringSchema(500),
    bio: optionalSafeStringSchema(1000),
  }),
});

/**
 * User ID parameter schema
 * GET/DELETE /api/users/:id
 */
export const userIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
