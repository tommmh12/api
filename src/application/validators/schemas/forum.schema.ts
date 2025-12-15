/**
 * Forum Validation Schemas
 * 
 * Schemas for forum-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema } from './common.schema.js';

// Forum post status enum
const forumPostStatusSchema = z.enum(['published', 'draft', 'hidden', 'deleted']);

// Target type for reactions
const targetTypeSchema = z.enum(['post', 'comment']);

/**
 * Create forum post request schema
 * POST /api/forum
 */
export const createForumPostSchema = z.object({
  body: z.object({
    title: safeStringSchema(1, 255),
    content: safeStringSchema(1, 50000),
    categoryId: uuidSchema.optional().nullable(),
    tags: z.array(safeStringSchema(1, 50)).max(10).optional(),
    isPinned: z.boolean().optional().default(false),
    status: forumPostStatusSchema.optional().default('published'),
  }),
});

/**
 * Update forum post request schema
 * PUT /api/forum/:id
 */
export const updateForumPostSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: safeStringSchema(1, 255).optional(),
    content: safeStringSchema(1, 50000).optional(),
    categoryId: uuidSchema.optional().nullable(),
    tags: z.array(safeStringSchema(1, 50)).max(10).optional(),
    isPinned: z.boolean().optional(),
    status: forumPostStatusSchema.optional(),
  }),
});

/**
 * Forum post ID parameter schema
 * GET/DELETE /api/forum/:id
 */
export const forumPostIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Moderate forum post request schema
 * POST /api/forum/:id/moderate
 */
export const moderateForumPostSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    action: z.enum(['approve', 'hide', 'delete', 'pin', 'unpin']),
    reason: optionalSafeStringSchema(500),
  }),
});

/**
 * Toggle vote request schema
 * POST /api/forum/:id/vote
 */
export const toggleVoteSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    voteType: z.enum(['up', 'down']),
  }),
});

/**
 * Create forum comment request schema
 * POST /api/forum/:postId/comments
 */
export const createForumCommentSchema = z.object({
  params: z.object({
    postId: uuidSchema,
  }),
  body: z.object({
    content: safeStringSchema(1, 10000),
    parentId: uuidSchema.optional().nullable(),
  }),
});

/**
 * Toggle reaction request schema
 * POST /api/forum/:targetType/:targetId/reaction
 */
export const toggleForumReactionSchema = z.object({
  params: z.object({
    targetType: targetTypeSchema,
    targetId: uuidSchema,
  }),
  body: z.object({
    reactionType: z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'angry']),
  }),
});

/**
 * Create category request schema
 * POST /api/forum/categories
 */
export const createCategorySchema = z.object({
  body: z.object({
    name: safeStringSchema(1, 100),
    description: optionalSafeStringSchema(500),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
    icon: optionalSafeStringSchema(50),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
});

/**
 * Update category request schema
 * PUT /api/forum/categories/:id
 */
export const updateCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: safeStringSchema(1, 100).optional(),
    description: optionalSafeStringSchema(500),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
    icon: optionalSafeStringSchema(50),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
});

// Type exports
export type CreateForumPostInput = z.infer<typeof createForumPostSchema>['body'];
export type UpdateForumPostInput = z.infer<typeof updateForumPostSchema>['body'];
export type ModerateForumPostInput = z.infer<typeof moderateForumPostSchema>['body'];
export type ToggleVoteInput = z.infer<typeof toggleVoteSchema>['body'];
export type CreateForumCommentInput = z.infer<typeof createForumCommentSchema>['body'];
export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
