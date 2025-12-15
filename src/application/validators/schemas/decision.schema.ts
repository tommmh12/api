/**
 * Decision Record Validation Schemas
 * 
 * Schemas for decision record API endpoints.
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema, paginationSchema } from './common.schema.js';

/**
 * Decision option schema for options considered
 */
export const decisionOptionSchema = z.object({
  title: safeStringSchema(1, 255),
  description: z.string().max(2000).optional().default(''),
  pros: z.array(z.string().max(500)).optional().default([]),
  cons: z.array(z.string().max(500)).optional().default([]),
  isSelected: z.boolean().optional().default(false),
});

/**
 * Decision status enum
 */
export const decisionStatusSchema = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED']);

/**
 * Create decision record request schema
 * POST /api/decisions
 * Requirements: 10.1
 */
export const createDecisionSchema = z.object({
  body: z.object({
    projectId: uuidSchema.optional().nullable(),
    taskId: uuidSchema.optional().nullable(),
    title: safeStringSchema(1, 255),
    context: safeStringSchema(1, 5000),
    optionsConsidered: z.array(decisionOptionSchema).optional().nullable(),
    decision: safeStringSchema(1, 5000),
    rationale: safeStringSchema(1, 5000),
    consequences: optionalSafeStringSchema(5000),
  }),
});

/**
 * Update decision record request schema
 * PUT /api/decisions/:id
 * Only for DRAFT status records
 */
export const updateDecisionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: safeStringSchema(1, 255).optional(),
    context: safeStringSchema(1, 5000).optional(),
    optionsConsidered: z.array(decisionOptionSchema).optional().nullable(),
    decision: safeStringSchema(1, 5000).optional(),
    rationale: safeStringSchema(1, 5000).optional(),
    consequences: optionalSafeStringSchema(5000),
  }),
});

/**
 * Revise decision record request schema
 * POST /api/decisions/:id/revise
 * Requirements: 10.5 - Preserve original decision history
 */
export const reviseDecisionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: safeStringSchema(1, 255),
    context: safeStringSchema(1, 5000),
    optionsConsidered: z.array(decisionOptionSchema).optional().nullable(),
    decision: safeStringSchema(1, 5000),
    rationale: safeStringSchema(1, 5000),
    consequences: optionalSafeStringSchema(5000),
  }),
});

/**
 * Approve decision record request schema
 * POST /api/decisions/:id/approve
 * Requirements: 10.2 - Approver assignment and timestamp
 */
export const approveDecisionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Submit decision for approval request schema
 * POST /api/decisions/:id/submit
 */
export const submitDecisionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Get decision by ID request schema
 * GET /api/decisions/:id
 */
export const getDecisionByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Get decisions by project request schema
 * GET /api/projects/:projectId/decisions
 */
export const getDecisionsByProjectSchema = z.object({
  params: z.object({
    projectId: uuidSchema,
  }),
});

/**
 * Get decisions by task request schema
 * GET /api/tasks/:taskId/decisions
 */
export const getDecisionsByTaskSchema = z.object({
  params: z.object({
    taskId: uuidSchema,
  }),
});

/**
 * Search decisions request schema
 * GET /api/decisions/search
 * Requirements: 10.3 - Search across decision records with filtering
 */
export const searchDecisionsSchema = z.object({
  query: z.object({
    q: z.string().max(255).optional(),
    projectId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    status: decisionStatusSchema.optional(),
    createdBy: uuidSchema.optional(),
    ...paginationSchema.shape,
  }),
});

/**
 * Get decision version history request schema
 * GET /api/decisions/:id/history
 */
export const getDecisionHistorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Link decision to comment request schema
 * POST /api/decisions/:id/link-comment
 * Requirements: 10.4 - Link between comment and decision record
 */
export const linkDecisionToCommentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    commentId: uuidSchema,
  }),
});

/**
 * Unlink decision from comment request schema
 * DELETE /api/decisions/:id/link-comment/:commentId
 */
export const unlinkDecisionFromCommentSchema = z.object({
  params: z.object({
    id: uuidSchema,
    commentId: uuidSchema,
  }),
});

/**
 * Get decisions by comment request schema
 * GET /api/comments/:commentId/decisions
 */
export const getDecisionsByCommentSchema = z.object({
  params: z.object({
    commentId: uuidSchema,
  }),
});

/**
 * Delete decision request schema
 * DELETE /api/decisions/:id
 */
export const deleteDecisionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Type exports
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>['body'];
export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>['body'];
export type ReviseDecisionInput = z.infer<typeof reviseDecisionSchema>['body'];
export type SearchDecisionsQuery = z.infer<typeof searchDecisionsSchema>['query'];
export type DecisionOption = z.infer<typeof decisionOptionSchema>;
