/**
 * Comment Validation Schemas
 * 
 * Schemas for comment-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema } from './common.schema.js';

// Commentable type enum
const commentableTypeSchema = z.enum(['forum_post', 'task']);

// Reaction type enum
const reactionTypeSchema = z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'angry']);

/**
 * Get comments by thread request schema
 * GET /api/comments/:type/:id
 */
export const getCommentsByThreadSchema = z.object({
  params: z.object({
    type: commentableTypeSchema,
    id: uuidSchema,
  }),
});

/**
 * Create comment request schema
 * POST /api/comments
 */
export const createCommentSchema = z.object({
  body: z.object({
    commentable_type: commentableTypeSchema,
    commentable_id: uuidSchema,
    parent_id: uuidSchema.optional().nullable(),
    content: safeStringSchema(1, 10000),
  }),
});

/**
 * Update comment request schema
 * PUT /api/comments/:id
 */
export const updateCommentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    content: safeStringSchema(1, 10000),
  }),
});

/**
 * Comment ID parameter schema
 * GET/DELETE/POST /api/comments/:id/*
 */
export const commentIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Toggle reaction request schema
 * POST /api/comments/:id/reactions
 */
export const toggleReactionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reaction_type: reactionTypeSchema,
  }),
});

// Type exports
export type GetCommentsByThreadParams = z.infer<typeof getCommentsByThreadSchema>['params'];
export type CreateCommentInput = z.infer<typeof createCommentSchema>['body'];
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>['body'];
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>['body'];
