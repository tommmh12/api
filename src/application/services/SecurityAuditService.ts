import {
  SecurityAuditLogRepository,
  SecurityAuditEventType,
  SecurityAuditLog,
  CreateSecurityAuditLogInput,
  SecurityAuditLogFilters,
} from "../../infrastructure/repositories/SecurityAuditLogRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("security-audit");

/**
 * Security Audit Service
 * Implements Requirements 3.1 - Security event audit logging
 * 
 * Logs security-relevant events: login, logout, password change, permission change
 * Includes: timestamp, userId, action, resource, outcome, IP
 */
export class SecurityAuditService {
  private repository: SecurityAuditLogRepository;

  constructor(repository?: SecurityAuditLogRepository) {
    this.repository = repository || new SecurityAuditLogRepository();
  }

  /**
   * Log a security audit event
   */
  async log(input: CreateSecurityAuditLogInput): Promise<SecurityAuditLog | null> {
    try {
      const auditLog = await this.repository.create(input);
      logger.debug("Security audit event logged", {
        eventType: input.eventType,
        userId: input.userId,
        action: input.action,
        outcome: input.outcome,
      });
      return auditLog;
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      logger.error("Failed to log security audit event", error as Error, {
        eventType: input.eventType,
        action: input.action,
      });
      return null;
    }
  }

  // ============================================
  // Convenience methods for common security events
  // ============================================

  /**
   * Log successful login
   * Requirements 3.1 - AUTH_LOGIN event
   */
  async logLogin(params: {
    userId: string;
    userEmail: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.log({
      eventType: "AUTH_LOGIN",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: "session",
      resourceId: params.userId,
      action: "user_login",
      outcome: "SUCCESS",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      correlationId: params.correlationId,
      metadata: {
        loginTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log failed login attempt
   * Requirements 3.1 - AUTH_FAILED event
   */
  async logLoginFailed(params: {
    attemptedEmail: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    reason?: string;
  }): Promise<void> {
    await this.log({
      eventType: "AUTH_FAILED",
      userId: null,
      userEmail: params.attemptedEmail,
      resourceType: "session",
      resourceId: null,
      action: "login_attempt_failed",
      outcome: "FAILURE",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      correlationId: params.correlationId,
      metadata: {
        attemptedEmail: params.attemptedEmail,
        reason: params.reason || "Invalid credentials",
        attemptTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log logout
   * Requirements 3.1 - AUTH_LOGOUT event
   */
  async logLogout(params: {
    userId: string;
    userEmail?: string;
    ipAddress?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.log({
      eventType: "AUTH_LOGOUT",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: "session",
      resourceId: params.userId,
      action: "user_logout",
      outcome: "SUCCESS",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        logoutTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log password change
   * Requirements 3.1 - PASSWORD_CHANGE event
   */
  async logPasswordChange(params: {
    userId: string;
    userEmail?: string;
    ipAddress?: string;
    correlationId?: string;
    success: boolean;
    reason?: string;
  }): Promise<void> {
    await this.log({
      eventType: "PASSWORD_CHANGE",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: "user",
      resourceId: params.userId,
      action: "password_change",
      outcome: params.success ? "SUCCESS" : "FAILURE",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        changeTime: new Date().toISOString(),
        reason: params.reason,
      },
    });
  }

  /**
   * Log permission change
   * Requirements 3.1 - PERMISSION_CHANGE event
   */
  async logPermissionChange(params: {
    userId: string;
    targetUserId: string;
    targetUserEmail?: string;
    oldRole?: string;
    newRole?: string;
    ipAddress?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.log({
      eventType: "PERMISSION_CHANGE",
      userId: params.userId,
      resourceType: "user",
      resourceId: params.targetUserId,
      action: "role_change",
      outcome: "SUCCESS",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        targetUserId: params.targetUserId,
        targetUserEmail: params.targetUserEmail,
        oldRole: params.oldRole,
        newRole: params.newRole,
        changeTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log bulk data access
   * Requirements 3.4 - Log access with export details
   */
  async logDataAccess(params: {
    userId: string;
    userEmail?: string;
    resourceType: string;
    resourceId?: string;
    action: string;
    ipAddress?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: "DATA_ACCESS",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: params.action,
      outcome: "SUCCESS",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        ...params.metadata,
        accessTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log data export
   * Requirements 3.4 - Log export with details
   */
  async logDataExport(params: {
    userId: string;
    userEmail?: string;
    resourceType: string;
    exportFormat?: string;
    recordCount?: number;
    ipAddress?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.log({
      eventType: "DATA_EXPORT",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: params.resourceType,
      resourceId: null,
      action: "data_export",
      outcome: "SUCCESS",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        exportFormat: params.exportFormat,
        recordCount: params.recordCount,
        exportTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Log admin action
   * Requirements 3.1 - ADMIN_ACTION event
   */
  async logAdminAction(params: {
    userId: string;
    userEmail?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    correlationId?: string;
    success: boolean;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: "ADMIN_ACTION",
      userId: params.userId,
      userEmail: params.userEmail,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: params.action,
      outcome: params.success ? "SUCCESS" : "FAILURE",
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
      metadata: {
        ...params.metadata,
        actionTime: new Date().toISOString(),
      },
    });
  }

  // ============================================
  // Query methods
  // ============================================

  /**
   * Query audit logs with filters
   */
  async query(
    filters: SecurityAuditLogFilters
  ): Promise<{ logs: SecurityAuditLog[]; total: number }> {
    return this.repository.findWithFilters(filters);
  }

  /**
   * Get audit logs for a specific user
   */
  async getByUserId(userId: string, limit?: number): Promise<SecurityAuditLog[]> {
    return this.repository.findByUserId(userId, limit);
  }

  /**
   * Get audit logs by event type
   */
  async getByEventType(
    eventType: SecurityAuditEventType,
    limit?: number
  ): Promise<SecurityAuditLog[]> {
    return this.repository.findByEventType(eventType, limit);
  }

  /**
   * Verify integrity of an audit log entry
   */
  async verifyIntegrity(id: string): Promise<boolean> {
    return this.repository.verifyIntegrity(id);
  }

  /**
   * Clean up old audit logs (respecting retention policy)
   * Requirements 3.2 - Minimum 90 days retention
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    if (retentionDays < 90) {
      logger.warn("Retention period less than 90 days not allowed", {
        requestedDays: retentionDays,
        minimumDays: 90,
      });
      retentionDays = 90;
    }
    return this.repository.deleteOlderThan(retentionDays);
  }
}

// Export singleton instance for convenience
export const securityAuditService = new SecurityAuditService();
