/**
 * Booking Validation Schemas
 * 
 * Schemas for booking-related API endpoints.
 * Requirements: 2.1 - Validate all input parameters against defined schemas
 */

import { z } from 'zod';
import { uuidSchema, safeStringSchema, optionalSafeStringSchema } from './common.schema.js';

// Booking status enum (exported for potential use in other modules)
export const bookingStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled', 'completed']);

// Booking type enum
const bookingTypeSchema = z.enum(['meeting', 'event', 'training', 'other']);

/**
 * Create booking request schema
 * POST /api/bookings
 */
export const createBookingSchema = z.object({
  body: z.object({
    roomId: uuidSchema,
    title: safeStringSchema(1, 255),
    description: optionalSafeStringSchema(2000),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    type: bookingTypeSchema.optional().default('meeting'),
    attendees: z.array(uuidSchema).optional(),
    isRecurring: z.boolean().optional().default(false),
    recurringPattern: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      interval: z.coerce.number().int().min(1).max(12),
      endDate: z.coerce.date(),
      daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
    }).optional().nullable(),
  }).refine(
    (data) => data.startTime < data.endTime,
    { message: 'Start time must be before end time', path: ['endTime'] }
  ).refine(
    (data) => data.startTime >= new Date(),
    { message: 'Start time must be in the future', path: ['startTime'] }
  ),
});

/**
 * Update booking request schema
 * PUT /api/bookings/:id
 */
export const updateBookingSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    roomId: uuidSchema.optional(),
    title: safeStringSchema(1, 255).optional(),
    description: optionalSafeStringSchema(2000),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    type: bookingTypeSchema.optional(),
    attendees: z.array(uuidSchema).optional(),
  }),
});

/**
 * Booking ID parameter schema
 * GET/DELETE /api/bookings/:id
 */
export const bookingIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Approve booking request schema
 * PUT /api/bookings/:id/approve
 */
export const approveBookingSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    notes: optionalSafeStringSchema(500),
  }).optional(),
});

/**
 * Reject booking request schema
 * PUT /api/bookings/:id/reject
 */
export const rejectBookingSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: safeStringSchema(1, 500),
  }),
});

/**
 * Cancel booking request schema
 * PUT /api/bookings/:id/cancel
 */
export const cancelBookingSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: optionalSafeStringSchema(500),
  }).optional(),
});

/**
 * Add participant request schema
 * POST /api/bookings/:id/participants
 */
export const addParticipantSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    participantId: uuidSchema,
  }),
});

/**
 * Remove participant request schema
 * DELETE /api/bookings/:id/participants/:participantId
 */
export const removeParticipantSchema = z.object({
  params: z.object({
    id: uuidSchema,
    participantId: uuidSchema,
  }),
});

// Type exports
export type CreateBookingInput = z.infer<typeof createBookingSchema>['body'];
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>['body'];
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>['body'];
export type AddParticipantInput = z.infer<typeof addParticipantSchema>['body'];
