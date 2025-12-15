import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";

/**
 * Security Audit Event Types
 * Based on Requirements 3.1 - Security-relevant events
 */
export type SecurityAuditEventType =
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_FAILED"
  | "PASSWORD_CHANGE"
  | "PERMISSION_CHANGE"
  | "DATA_ACCESS"
  | "DATA_EXPORT"
  | "ADMIN_ACTION";

export type AuditOutcome = "SUCCESS" | "FAILURE";

/**
 * Security Audit Log Entry
 * Based on design document Data Models section
 */
export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  eventType: SecurityAuditEventType;
  userId: string | null;
  userEmail?: string;
  resourceType: string;
  resourceId: string | null;
  action: string;
  outcome: AuditOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  metadata: Record<string, any> | null;
  checksum: string;
  createdAt?: Date;
}

/**
 * Input for creating a new audit log entry
 */
export interface CreateSecurityAuditLogInput {
  eventType: SecurityAuditEventType;
  userId?: string | null;
  userEmail?: string;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  outcome: AuditOutcome;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Filters for querying audit logs
 */
export interface SecurityAuditLogFilters {
  limit?: number;
  offset?: number;
  eventType?: SecurityAuditEventType;
  userId?: string;
  outcome?: AuditOutcome;
  startDate?: string;
  endDate?: string;
  correlationId?: string;
}

/**
 * Repository for Security Audit Logs
 * Implements Requirements 3.1 - Security event audit logging
 */
export class SecurityAuditLogRepository {
  private db = dbPool;

  /**
   * Generate checksum for tamper detection
   * Based on design document - integrity protection
   */
  private generateChecksum(data: {
    timestamp: Date;
    eventType: string;
    userId: string | null;
    action: string;
    outcome: string;
  }): string {
    const content = JSON.stringify({
      timestamp: data.timestamp.toISOString(),
      eventType: data.eventType,
      userId: data.userId,
      action: data.action,
      outcome: data.outcome,
    });
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Create a new security audit log entry
   * Requirements 3.1 - Create audit log entry with timestamp, user ID, action, resource, outcome
   */
  async create(input: CreateSecurityAuditLogInput): Promise<SecurityAuditLog> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    const checksum = this.generateChecksum({
      timestamp,
      eventType: input.eventType,
      userId: input.userId || null,
      action: input.action,
      outcome: input.outcome,
    });

    await this.db.query<ResultSetHeader>(
      `INSERT INTO security_audit_logs (
        id, timestamp, event_type, user_id, user_email, resource_type, 
        resource_id, action, outcome, ip_address, user_agent, 
        correlation_id, metadata, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        input.eventType,
        input.userId || null,
        input.userEmail || null,
        input.resourceType,
        input.resourceId || null,
        input.action,
        input.outcome,
        input.ipAddress || null,
        input.userAgent || null,
        input.correlationId || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        checksum,
      ]
    );

    return {
      id,
      timestamp,
      eventType: input.eventType,
      userId: input.userId || null,
      userEmail: input.userEmail,
      resourceType: input.resourceType,
      resourceId: input.resourceId || null,
      action: input.action,
      outcome: input.outcome,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      correlationId: input.correlationId || null,
      metadata: input.metadata || null,
      checksum,
    };
  }

  /**
   * Find audit logs with filters
   */
  async findWithFilters(
    filters: SecurityAuditLogFilters
  ): Promise<{ logs: SecurityAuditLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      eventType,
      userId,
      outcome,
      startDate,
      endDate,
      correlationId,
    } = filters;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (eventType) {
      whereClause += " AND event_type = ?";
      params.push(eventType);
    }

    if (userId) {
      whereClause += " AND user_id = ?";
      params.push(userId);
    }

    if (outcome) {
      whereClause += " AND outcome = ?";
      params.push(outcome);
    }

    if (correlationId) {
      whereClause += " AND correlation_id = ?";
      params.push(correlationId);
    }

    if (startDate) {
      whereClause += " AND timestamp >= ?";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND timestamp <= ?";
      params.push(endDate + " 23:59:59");
    }

    // Get total count
    const [countResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM security_audit_logs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM security_audit_logs ${whereClause}
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      logs: rows.map((row) => this.mapRowToAuditLog(row)),
      total,
    };
  }

  /**
   * Find audit log by ID
   */
  async findById(id: string): Promise<SecurityAuditLog | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM security_audit_logs WHERE id = ?",
      [id]
    );

    if (rows.length === 0) return null;
    return this.mapRowToAuditLog(rows[0]);
  }

  /**
   * Find audit logs by user ID
   */
  async findByUserId(
    userId: string,
    limit: number = 100
  ): Promise<SecurityAuditLog[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM security_audit_logs 
       WHERE user_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [userId, limit]
    );

    return rows.map((row) => this.mapRowToAuditLog(row));
  }

  /**
   * Find audit logs by event type
   */
  async findByEventType(
    eventType: SecurityAuditEventType,
    limit: number = 100
  ): Promise<SecurityAuditLog[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM security_audit_logs 
       WHERE event_type = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [eventType, limit]
    );

    return rows.map((row) => this.mapRowToAuditLog(row));
  }

  /**
   * Verify checksum integrity
   */
  async verifyIntegrity(id: string): Promise<boolean> {
    const log = await this.findById(id);
    if (!log) return false;

    const expectedChecksum = this.generateChecksum({
      timestamp: log.timestamp,
      eventType: log.eventType,
      userId: log.userId,
      action: log.action,
      outcome: log.outcome,
    });

    return log.checksum === expectedChecksum;
  }

  /**
   * Delete logs older than specified days
   * Requirements 3.2 - Retention policy (minimum 90 days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM security_audit_logs 
       WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    return result.affectedRows;
  }

  /**
   * Map database row to SecurityAuditLog interface
   */
  private mapRowToAuditLog(row: RowDataPacket): SecurityAuditLog {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      eventType: row.event_type as SecurityAuditEventType,
      userId: row.user_id,
      userEmail: row.user_email,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      outcome: row.outcome as AuditOutcome,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      correlationId: row.correlation_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      checksum: row.checksum,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    };
  }
}
