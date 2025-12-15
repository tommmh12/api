/**
 * Task Validation Schemas
 * 
 * Schemas for task-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema, prioritySchema } from './common.schema.js';

/**
 * Create task request schema
 * POST /api/tasks
 */
export const createTaskSchema = z.object({
  body: z.object({
    projectId: uuidSchema,
    title: safeStringSchema(1, 255),
    description: optionalSafeStringSchema(5000),
    statusId: uuidSchema.optional(),
    priority: prioritySchema.optional().default('medium'),
    assigneeId: uuidSchema.optional().nullable(),
    // Task owner - single responsible person (Requirements: 8.1)
    ownerId: uuidSchema.optional().nullable(),
    departmentId: uuidSchema.optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    estimatedHours: z.coerce.number().min(0).max(9999).optional().nullable(),
  }),
});

/**
 * Update task request schema
 * PUT /api/tasks/:id
 */
export const updateTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: safeStringSchema(1, 255).optional(),
    description: optionalSafeStringSchema(5000),
    statusId: uuidSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: uuidSchema.optional().nullable(),
    // Task owner - single responsible person (Requirements: 8.1)
    ownerId: uuidSchema.optional().nullable(),
    departmentId: uuidSchema.optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    estimatedHours: z.coerce.number().min(0).max(9999).optional().nullable(),
    actualHours: z.coerce.number().min(0).max(9999).optional().nullable(),
  }),
});

/**
 * Update task status request schema
 * PATCH /api/tasks/:id/status
 */
export const updateTaskStatusSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    statusId: uuidSchema,
  }),
});

/**
 * Get tasks by project request schema
 * GET /api/tasks/project/:projectId
 */
export const getTasksByProjectSchema = z.object({
  params: z.object({
    projectId: uuidSchema,
  }),
});

/**
 * Task ID parameter schema
 * GET/DELETE /api/tasks/:id
 */
export const taskIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Add checklist item request schema
 * POST /api/tasks/:id/checklist
 * Requirements: 11.2 - Support mandatory checklist items
 */
export const addChecklistItemSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    text: safeStringSchema(1, 500),
    isMandatory: z.boolean().optional().default(false),
  }),
});

/**
 * Update checklist item request schema
 * PUT /api/tasks/checklist/:itemId
 * Requirements: 11.2 - Support mandatory checklist items
 */
export const updateChecklistItemSchema = z.object({
  params: z.object({
    itemId: uuidSchema,
  }),
  body: z.object({
    text: safeStringSchema(1, 500).optional(),
    isCompleted: z.boolean().optional(),
    isMandatory: z.boolean().optional(),
  }),
});

/**
 * Delete checklist item request schema
 * DELETE /api/tasks/checklist/:itemId
 */
export const deleteChecklistItemSchema = z.object({
  params: z.object({
    itemId: uuidSchema,
  }),
});

/**
 * Get ownership enforcement mode request schema
 * GET /api/tasks/ownership/enforcement/:departmentId
 */
export const getOwnershipEnforcementSchema = z.object({
  params: z.object({
    departmentId: uuidSchema,
  }),
});

/**
 * Set ownership enforcement mode request schema
 * PUT /api/tasks/ownership/enforcement/:departmentId
 */
export const setOwnershipEnforcementSchema = z.object({
  params: z.object({
    departmentId: uuidSchema,
  }),
  body: z.object({
    mode: z.enum(['warn', 'block']),
  }),
});

/**
 * Validate task ownership request schema
 * POST /api/tasks/ownership/validate
 */
export const validateOwnershipSchema = z.object({
  body: z.object({
    ownerId: uuidSchema.optional().nullable(),
    departmentId: uuidSchema.optional().nullable(),
  }),
});

// Type exports
export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>['body'];
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>['body'];
export type SetOwnershipEnforcementInput = z.infer<typeof setOwnershipEnforcementSchema>['body'];
export type ValidateOwnershipInput = z.infer<typeof validateOwnershipSchema>['body'];
