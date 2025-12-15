/**
 * OpenAPI/Swagger Configuration
 * Requirements: 14.1 - API Documentation
 * 
 * This module configures swagger-jsdoc to generate OpenAPI 3.0 documentation
 * from JSDoc comments in route files.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nexus Internal Portal API',
      version: '1.0.0',
      description: `
## Overview

Nexus Internal Portal API provides endpoints for managing internal operations including:
- **Authentication** - User login, logout, and session management
- **Projects** - Project CRUD operations and member management
- **Tasks** - Task management with ownership, dependencies, and handoffs
- **Departments** - Department hierarchy and management
- **Chat** - Real-time messaging and group chat
- **News & Forum** - Internal communication channels
- **Bookings** - Room and resource booking
- **Notifications** - User notification management
- **Decision Records** - Decision documentation and tracking

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

Authentication endpoints are rate-limited to prevent brute force attacks:
- Login: 5 attempts per 15 minutes per IP
- Password change: 5 attempts per 15 minutes per IP

## Error Responses

All errors follow a consistent format:
\`\`\`json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": [{ "field": "fieldName", "message": "Field-specific error" }],
  "correlationId": "uuid-for-tracing"
}
\`\`\`
      `,
      contact: {
        name: 'Nexus Development Team',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        // Common response schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            code: { type: 'string', example: 'ERROR_CODE' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email format' },
                  code: { type: 'string', example: 'INVALID_FORMAT' },
                },
              },
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 10 },
                total: { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 10 },
              },
            },
          },
        },
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
            departmentId: { type: 'string', format: 'uuid' },
            avatar: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // Project schemas
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string', example: 'PRJ-001' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            departmentId: { type: 'string', format: 'uuid' },
            managerId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateProject: {
          type: 'object',
          required: ['name', 'departmentId'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            status: { type: 'string', enum: ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            departmentId: { type: 'string', format: 'uuid' },
            managerId: { type: 'string', format: 'uuid' },
          },
        },
        // Task schemas
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string', example: 'TSK-001' },
            projectId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            ownerId: { type: 'string', format: 'uuid' },
            assigneeId: { type: 'string', format: 'uuid' },
            dueDate: { type: 'string', format: 'date' },
            blockedReason: { type: 'string', nullable: true },
            blockedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateTask: {
          type: 'object',
          required: ['projectId', 'title', 'ownerId'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            ownerId: { type: 'string', format: 'uuid' },
            assigneeId: { type: 'string', format: 'uuid' },
            dueDate: { type: 'string', format: 'date' },
          },
        },
        // Checklist schemas
        ChecklistItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            taskId: { type: 'string', format: 'uuid' },
            text: { type: 'string' },
            isCompleted: { type: 'boolean' },
            isMandatory: { type: 'boolean' },
            completedBy: { type: 'string', format: 'uuid', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        // Handoff schemas
        Handoff: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            taskId: { type: 'string', format: 'uuid' },
            fromDepartmentId: { type: 'string', format: 'uuid' },
            toDepartmentId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
            notes: { type: 'string' },
            rejectionReason: { type: 'string', nullable: true },
            initiatedBy: { type: 'string', format: 'uuid' },
            initiatedAt: { type: 'string', format: 'date-time' },
            respondedBy: { type: 'string', format: 'uuid', nullable: true },
            respondedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        // Decision Record schemas
        DecisionRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid', nullable: true },
            taskId: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string' },
            context: { type: 'string' },
            decision: { type: 'string' },
            rationale: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'pending_approval', 'approved', 'superseded'] },
            createdBy: { type: 'string', format: 'uuid' },
            approvedBy: { type: 'string', format: 'uuid', nullable: true },
            version: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // Department schemas
        Department: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            managerId: { type: 'string', format: 'uuid', nullable: true },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // Health check schemas
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                    responseTime: { type: 'number' },
                  },
                },
                fileStorage: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                  },
                },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Authentication required',
                code: 'UNAUTHORIZED',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Access denied',
                code: 'FORBIDDEN',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Resource not found',
                code: 'NOT_FOUND',
              },
            },
          },
        },
        ValidationError: {
          description: 'Input validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          headers: {
            'Retry-After': {
              description: 'Seconds until rate limit resets',
              schema: { type: 'integer' },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'Too many requests. Please try again later.',
                code: 'RATE_LIMITED',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                message: 'An unexpected error occurred',
                code: 'INTERNAL_ERROR',
                correlationId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'User authentication and session management' },
      { name: 'Users', description: 'User management operations' },
      { name: 'Projects', description: 'Project CRUD and member management' },
      { name: 'Tasks', description: 'Task management with ownership and dependencies' },
      { name: 'Departments', description: 'Department hierarchy management' },
      { name: 'Chat', description: 'Real-time messaging' },
      { name: 'News', description: 'Internal news articles' },
      { name: 'Forum', description: 'Discussion forum' },
      { name: 'Bookings', description: 'Room and resource booking' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Handoffs', description: 'Cross-department task handoffs' },
      { name: 'Decisions', description: 'Decision record management' },
      { name: 'Health', description: 'System health checks' },
      { name: 'Settings', description: 'System settings' },
    ],
  },
  apis: ['./src/presentation/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
