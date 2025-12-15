/**
 * Common Validation Schemas
 * 
 * Shared schemas and utilities used across multiple domains.
 * Requirements: 2.1 - Strict type checking
 */

import { z } from 'zod';

// UUID validation pattern
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ID parameter schema
export const idParamSchema = z.object({
  id: uuidSchema,
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

// Email validation
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters');

// Safe string - prevents empty strings and trims whitespace
export const safeStringSchema = (minLength = 1, maxLength = 255) => 
  z.string()
    .trim()
    .min(minLength, `Must be at least ${minLength} character(s)`)
    .max(maxLength, `Must not exceed ${maxLength} characters`);

// Optional safe string
export const optionalSafeStringSchema = (maxLength = 255) =>
  z.string()
    .trim()
    .max(maxLength, `Must not exceed ${maxLength} characters`)
    .optional()
    .nullable();

// Status enum for common use
export const statusSchema = z.enum(['active', 'inactive', 'pending', 'archived']);

// Priority enum
export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
