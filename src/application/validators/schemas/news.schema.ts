/**
 * News Validation Schemas
 * 
 * Schemas for news-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema } from './common.schema.js';

// News article status enum
const newsStatusSchema = z.enum(['draft', 'published', 'archived', 'hidden']);

// News category enum
const newsCategorySchema = z.enum(['announcement', 'event', 'update', 'general']);

/**
 * Create news article request schema
 * POST /api/news
 */
export const createNewsSchema = z.object({
  body: z.object({
    title: safeStringSchema(1, 255),
    content: safeStringSchema(1, 100000),
    summary: optionalSafeStringSchema(500),
    category: newsCategorySchema.optional().default('general'),
    status: newsStatusSchema.optional().default('draft'),
    featuredImage: optionalSafeStringSchema(500),
    publishedAt: z.coerce.date().optional().nullable(),
    isPinned: z.boolean().optional().default(false),
    tags: z.array(safeStringSchema(1, 50)).max(10).optional(),
  }),
});

/**
 * Update news article request schema
 * PUT /api/news/:id
 */
export const updateNewsSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: safeStringSchema(1, 255).optional(),
    content: safeStringSchema(1, 100000).optional(),
    summary: optionalSafeStringSchema(500),
    category: newsCategorySchema.optional(),
    status: newsStatusSchema.optional(),
    featuredImage: optionalSafeStringSchema(500),
    publishedAt: z.coerce.date().optional().nullable(),
    isPinned: z.boolean().optional(),
    tags: z.array(safeStringSchema(1, 50)).max(10).optional(),
  }),
});

/**
 * News article ID parameter schema
 * GET/DELETE /api/news/:id
 */
export const newsIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Moderate news article request schema
 * POST /api/news/:id/moderate
 */
export const moderateNewsSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    action: z.enum(['publish', 'hide', 'archive', 'delete']),
    reason: optionalSafeStringSchema(500),
  }),
});

/**
 * Create news comment request schema
 * POST /api/news/:articleId/comments
 */
export const createNewsCommentSchema = z.object({
  params: z.object({
    articleId: uuidSchema,
  }),
  body: z.object({
    content: safeStringSchema(1, 5000),
    parentId: uuidSchema.optional().nullable(),
  }),
});

/**
 * Moderate news comment request schema
 * POST /api/news/comments/:commentId/moderate
 */
export const moderateNewsCommentSchema = z.object({
  params: z.object({
    commentId: uuidSchema,
  }),
  body: z.object({
    action: z.enum(['approve', 'hide', 'delete']),
    reason: optionalSafeStringSchema(500),
  }),
});

// Type exports
export type CreateNewsInput = z.infer<typeof createNewsSchema>['body'];
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>['body'];
export type ModerateNewsInput = z.infer<typeof moderateNewsSchema>['body'];
export type CreateNewsCommentInput = z.infer<typeof createNewsCommentSchema>['body'];
export type ModerateNewsCommentInput = z.infer<typeof moderateNewsCommentSchema>['body'];
