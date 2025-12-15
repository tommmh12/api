/**
 * Project Validation Schemas
 * 
 * Schemas for project-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema } from './common.schema.js';

// Project status enum
const projectStatusSchema = z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']);

// Member role enum
const memberRoleSchema = z.enum(['owner', 'manager', 'member', 'viewer']);

/**
 * Create project request schema
 * POST /api/projects
 */
export const createProjectSchema = z.object({
  body: z.object({
    name: safeStringSchema(1, 255),
    code: safeStringSchema(1, 50).optional(),
    description: optionalSafeStringSchema(5000),
    departmentId: uuidSchema.optional().nullable(),
    status: projectStatusSchema.optional().default('planning'),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    budget: z.coerce.number().min(0).optional().nullable(),
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before or equal to end date', path: ['endDate'] }
  ),
});

/**
 * Update project request schema
 * PUT /api/projects/:id
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: safeStringSchema(1, 255).optional(),
    code: safeStringSchema(1, 50).optional(),
    description: optionalSafeStringSchema(5000),
    departmentId: uuidSchema.optional().nullable(),
    status: projectStatusSchema.optional(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    budget: z.coerce.number().min(0).optional().nullable(),
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before or equal to end date', path: ['endDate'] }
  ),
});

/**
 * Project ID parameter schema
 * GET/DELETE /api/projects/:id
 */
export const projectIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Add member request schema
 * POST /api/projects/:id/members
 */
export const addMemberSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    userId: uuidSchema,
    role: memberRoleSchema.optional().default('member'),
  }),
});

/**
 * Remove member request schema
 * DELETE /api/projects/:id/members/:userId
 */
export const removeMemberSchema = z.object({
  params: z.object({
    id: uuidSchema,
    userId: uuidSchema,
  }),
});

// Type exports
export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type AddMemberInput = z.infer<typeof addMemberSchema>['body'];
