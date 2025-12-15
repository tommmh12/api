/**
 * Handoff Validation Schemas
 * 
 * Schemas for handoff-related API endpoints.
 * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
 * Requirements: 9.4 - Handoff rejection with reason requirement
 */

import { z } from 'zod';
import { uuidSchema, optionalSafeStringSchema } from './common.schema.js';

/**
 * Initiate handoff request schema
 * POST /api/tasks/:id/handoff
 */
export const initiateHandoffSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    toDepartmentId: uuidSchema,
    checklistCompleted: z.boolean().optional().default(false),
    notes: optionalSafeStringSchema(2000),
  }),
});

/**
 * Accept handoff request schema
 * POST /api/handoffs/:id/accept
 */
export const acceptHandoffSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Reject handoff request schema
 * POST /api/handoffs/:id/reject
 * Requirements: 9.4 - Rejection reason is required
 */
export const rejectHandoffSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    rejectionReason: z.string()
      .min(1, 'Rejection reason is required')
      .max(1000, 'Rejection reason must be less than 1000 characters')
      .transform(val => val.trim()),
  }),
});

/**
 * Get handoff by ID request schema
 * GET /api/handoffs/:id
 */
export const getHandoffByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Get handoffs by task ID request schema
 * GET /api/tasks/:id/handoffs
 */
export const getHandoffsByTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Get handoffs by department request schema
 * GET /api/handoffs/department/:departmentId
 */
export const getHandoffsByDepartmentSchema = z.object({
  params: z.object({
    departmentId: uuidSchema,
  }),
  query: z.object({
    type: z.enum(['incoming', 'outgoing', 'pending']).optional().default('pending'),
  }),
});

// Type exports
export type InitiateHandoffInput = z.infer<typeof initiateHandoffSchema>['body'];
export type RejectHandoffInput = z.infer<typeof rejectHandoffSchema>['body'];
