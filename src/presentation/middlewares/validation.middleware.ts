/**
 * Centralized Validation Middleware
 * 
 * This middleware validates incoming requests against Zod schemas
 * and returns structured error responses without exposing internal details.
 * 
 * Requirements:
 * - 2.1: Validate all input parameters against defined schemas with strict type checking
 * - 2.5: Return structured error responses without exposing internal system details
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Structured field error for API responses
 */
interface FieldError {
  field: string;
  message: string;
  code: string;
}

/**
 * Structured error response format
 * Requirements: 2.5 - Structured error responses without internal details
 */
interface ValidationErrorResponse {
  success: false;
  message: string;
  code: string;
  errors: FieldError[];
  correlationId: string;
}

/**
 * Maps Zod error codes to user-friendly error codes
 */
function mapZodCodeToErrorCode(issue: ZodIssue): string {
  // Use string comparison to avoid TypeScript strict type checking issues
  const code = String(issue.code);
  
  const codeMap: Record<string, string> = {
    'invalid_type': 'INVALID_TYPE',
    'too_small': 'VALUE_TOO_SHORT',
    'too_big': 'VALUE_TOO_LONG',
    'invalid_enum_value': 'INVALID_ENUM_VALUE',
    'invalid_date': 'INVALID_DATE',
    'custom': 'VALIDATION_FAILED',
    'invalid_union': 'INVALID_VALUE',
    'invalid_literal': 'INVALID_VALUE',
    'unrecognized_keys': 'UNKNOWN_FIELD',
    'invalid_arguments': 'INVALID_ARGUMENTS',
    'invalid_return_type': 'INVALID_RETURN',
    'invalid_intersection_types': 'INVALID_TYPE',
    'not_multiple_of': 'INVALID_NUMBER',
    'not_finite': 'INVALID_NUMBER',
  };
  
  if (code === 'invalid_string') {
    const validation = (issue as any).validation;
    if (validation) {
      const validationMap: Record<string, string> = {
        'email': 'INVALID_EMAIL',
        'uuid': 'INVALID_UUID',
        'url': 'INVALID_URL',
        'regex': 'INVALID_FORMAT',
        'cuid': 'INVALID_ID',
        'datetime': 'INVALID_DATETIME',
        'ip': 'INVALID_IP',
      };
      return validationMap[validation] || 'INVALID_STRING';
    }
    return 'INVALID_STRING';
  }
  
  return codeMap[code] || 'VALIDATION_ERROR';
}

/**
 * Formats a Zod issue path to a field name string
 */
function formatFieldPath(path: (string | number)[]): string {
  if (path.length === 0) return 'request';
  
  // Remove 'body', 'params', 'query' prefixes for cleaner field names
  const filteredPath = path.filter(p => !['body', 'params', 'query'].includes(String(p)));
  
  if (filteredPath.length === 0) return 'request';
  
  return filteredPath.map((p, i) => {
    if (typeof p === 'number') {
      return `[${p}]`;
    }
    return i === 0 ? p : `.${p}`;
  }).join('');
}

/**
 * Transforms Zod errors into structured field errors
 * Requirements: 2.5 - Field-specific error messages
 */
function transformZodErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: formatFieldPath(issue.path as (string | number)[]),
    message: issue.message,
    code: mapZodCodeToErrorCode(issue),
  }));
}

/**
 * Creates a validation middleware for a given Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 * 
 * Usage:
 * ```typescript
 * import { validate } from '../middlewares/validation.middleware.js';
 * import { createTaskSchema } from '../../application/validators/schemas/index.js';
 * 
 * router.post('/', validate(createTaskSchema), TaskController.createTask);
 * ```
 */
export function validate(schema: ZodSchema): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = (req as any).correlationId || uuidv4();
    
    try {
      // Validate the request against the schema
      const validatedData = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Attach validated and sanitized data to request
      // This ensures controllers receive clean, typed data
      const data = validatedData as Record<string, unknown>;
      
      if (data.body && typeof data.body === 'object') {
        req.body = data.body;
      }
      if (data.params && typeof data.params === 'object') {
        req.params = data.params as any;
      }
      if (data.query && typeof data.query === 'object') {
        req.query = data.query as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse: ValidationErrorResponse = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: transformZodErrors(error),
          correlationId,
        };

        res.status(400).json(errorResponse);
        return;
      }

      // For non-Zod errors, pass to global error handler
      // Never expose internal error details
      next(error);
    }
  };
}

/**
 * Validates only the request body (convenience wrapper)
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return validate(schema.transform((data) => ({ body: data })));
}

/**
 * Validates only the request params (convenience wrapper)
 */
export function validateParams(schema: ZodSchema): RequestHandler {
  return validate(schema.transform((data) => ({ params: data })));
}

/**
 * Validates only the request query (convenience wrapper)
 */
export function validateQuery(schema: ZodSchema): RequestHandler {
  return validate(schema.transform((data) => ({ query: data })));
}

/**
 * Combines multiple validation middlewares
 * Useful when you need to validate body, params, and query separately
 */
export function validateAll(...middlewares: RequestHandler[]): RequestHandler[] {
  return middlewares;
}

export default validate;
