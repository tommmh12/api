/**
 * HandoffRepository
 * Data access layer for handoff_records table
 * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
 * Requirements: 9.4 - Handoff rejection with reason requirement
 */

import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("HandoffRepository");

export interface HandoffRecord {
  id: string;
  taskId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  checklistCompleted: boolean;
  notes: string | null;
  initiatedBy: string;
  initiatedAt: Date;
  respondedBy: string | null;
  respondedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HandoffRecordWithDetails extends HandoffRecord {
  taskTitle?: string;
  taskCode?: string;
  fromDepartmentName?: string;
  toDepartmentName?: string;
  initiatedByName?: string;
  respondedByName?: string;
}

export interface CreateHandoffData {
  taskId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  checklistCompleted?: boolean;
  notes?: string;
  initiatedBy: string;
}

export class HandoffRepository {
  private db = dbPool;

  /**
   * Create a new handoff record
   */
  async create(data: CreateHandoffData): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    const query = `
      INSERT INTO handoff_records (
        id, task_id, from_department_id, to_department_id,
        status, checklist_completed, notes, initiated_by, initiated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `;

    try {
      await this.db.query(query, [
        id,
        data.taskId,
        data.fromDepartmentId,
        data.toDepartmentId,
        data.checklistCompleted ?? false,
        data.notes || null,
        data.initiatedBy,
        now,
      ]);

      logger.info("Handoff record created", { handoffId: id, taskId: data.taskId });
      return id;
    } catch (error) {
      logger.error("Error creating handoff record", error as Error, { data });
      throw error;
    }
  }

  /**
   * Get handoff record by ID
   */
  async findById(id: string): Promise<HandoffRecordWithDetails | null> {
    const query = `
      SELECT 
        h.*,
        t.title as task_title,
        t.code as task_code,
        fd.name as from_department_name,
        td.name as to_department_name,
        ui.full_name as initiated_by_name,
        ur.full_name as responded_by_name
      FROM handoff_records h
      LEFT JOIN tasks t ON h.task_id = t.id
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      LEFT JOIN users ui ON h.initiated_by = ui.id
      LEFT JOIN users ur ON h.responded_by = ur.id
      WHERE h.id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
      if (rows.length === 0) return null;

      return this.mapRowToHandoff(rows[0]);
    } catch (error) {
      logger.error("Error finding handoff by ID", error as Error, { id });
      throw error;
    }
  }

  /**
   * Get all handoff records for a task
   */
  async findByTaskId(taskId: string): Promise<HandoffRecordWithDetails[]> {
    const query = `
      SELECT 
        h.*,
        t.title as task_title,
        t.code as task_code,
        fd.name as from_department_name,
        td.name as to_department_name,
        ui.full_name as initiated_by_name,
        ur.full_name as responded_by_name
      FROM handoff_records h
      LEFT JOIN tasks t ON h.task_id = t.id
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      LEFT JOIN users ui ON h.initiated_by = ui.id
      LEFT JOIN users ur ON h.responded_by = ur.id
      WHERE h.task_id = ?
      ORDER BY h.initiated_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => this.mapRowToHandoff(row));
    } catch (error) {
      logger.error("Error finding handoffs by task ID", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get pending handoffs for a department (incoming)
   */
  async findPendingByDepartment(departmentId: string): Promise<HandoffRecordWithDetails[]> {
    const query = `
      SELECT 
        h.*,
        t.title as task_title,
        t.code as task_code,
        fd.name as from_department_name,
        td.name as to_department_name,
        ui.full_name as initiated_by_name,
        ur.full_name as responded_by_name
      FROM handoff_records h
      LEFT JOIN tasks t ON h.task_id = t.id
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      LEFT JOIN users ui ON h.initiated_by = ui.id
      LEFT JOIN users ur ON h.responded_by = ur.id
      WHERE h.to_department_id = ? AND h.status = 'PENDING'
      ORDER BY h.initiated_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [departmentId]);
      return rows.map(row => this.mapRowToHandoff(row));
    } catch (error) {
      logger.error("Error finding pending handoffs", error as Error, { departmentId });
      throw error;
    }
  }

  /**
   * Get outgoing handoffs from a department
   */
  async findOutgoingByDepartment(departmentId: string): Promise<HandoffRecordWithDetails[]> {
    const query = `
      SELECT 
        h.*,
        t.title as task_title,
        t.code as task_code,
        fd.name as from_department_name,
        td.name as to_department_name,
        ui.full_name as initiated_by_name,
        ur.full_name as responded_by_name
      FROM handoff_records h
      LEFT JOIN tasks t ON h.task_id = t.id
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      LEFT JOIN users ui ON h.initiated_by = ui.id
      LEFT JOIN users ur ON h.responded_by = ur.id
      WHERE h.from_department_id = ?
      ORDER BY h.initiated_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [departmentId]);
      return rows.map(row => this.mapRowToHandoff(row));
    } catch (error) {
      logger.error("Error finding outgoing handoffs", error as Error, { departmentId });
      throw error;
    }
  }

  /**
   * Update handoff status to ACCEPTED
   */
  async accept(id: string, respondedBy: string): Promise<void> {
    const query = `
      UPDATE handoff_records 
      SET status = 'ACCEPTED', responded_by = ?, responded_at = NOW()
      WHERE id = ? AND status = 'PENDING'
    `;

    try {
      const [result] = await this.db.query(query, [respondedBy, id]);
      const affectedRows = (result as any).affectedRows;
      
      if (affectedRows === 0) {
        throw new Error("Handoff not found or already processed");
      }

      logger.info("Handoff accepted", { handoffId: id, respondedBy });
    } catch (error) {
      logger.error("Error accepting handoff", error as Error, { id, respondedBy });
      throw error;
    }
  }

  /**
   * Update handoff status to REJECTED with reason
   */
  async reject(id: string, respondedBy: string, rejectionReason: string): Promise<void> {
    const query = `
      UPDATE handoff_records 
      SET status = 'REJECTED', responded_by = ?, responded_at = NOW(), rejection_reason = ?
      WHERE id = ? AND status = 'PENDING'
    `;

    try {
      const [result] = await this.db.query(query, [respondedBy, rejectionReason, id]);
      const affectedRows = (result as any).affectedRows;
      
      if (affectedRows === 0) {
        throw new Error("Handoff not found or already processed");
      }

      logger.info("Handoff rejected", { handoffId: id, respondedBy, rejectionReason });
    } catch (error) {
      logger.error("Error rejecting handoff", error as Error, { id, respondedBy });
      throw error;
    }
  }

  /**
   * Check if there's a pending handoff for a task
   */
  async hasPendingHandoff(taskId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM handoff_records 
      WHERE task_id = ? AND status = 'PENDING'
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows[0].count > 0;
    } catch (error) {
      logger.error("Error checking pending handoff", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get the latest handoff for a task
   */
  async findLatestByTaskId(taskId: string): Promise<HandoffRecordWithDetails | null> {
    const query = `
      SELECT 
        h.*,
        t.title as task_title,
        t.code as task_code,
        fd.name as from_department_name,
        td.name as to_department_name,
        ui.full_name as initiated_by_name,
        ur.full_name as responded_by_name
      FROM handoff_records h
      LEFT JOIN tasks t ON h.task_id = t.id
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      LEFT JOIN users ui ON h.initiated_by = ui.id
      LEFT JOIN users ur ON h.responded_by = ur.id
      WHERE h.task_id = ?
      ORDER BY h.initiated_at DESC
      LIMIT 1
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      if (rows.length === 0) return null;

      return this.mapRowToHandoff(rows[0]);
    } catch (error) {
      logger.error("Error finding latest handoff", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Map database row to HandoffRecordWithDetails
   */
  private mapRowToHandoff(row: RowDataPacket): HandoffRecordWithDetails {
    return {
      id: row.id,
      taskId: row.task_id,
      fromDepartmentId: row.from_department_id,
      toDepartmentId: row.to_department_id,
      status: row.status,
      checklistCompleted: !!row.checklist_completed,
      notes: row.notes,
      initiatedBy: row.initiated_by,
      initiatedAt: row.initiated_at,
      respondedBy: row.responded_by,
      respondedAt: row.responded_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      taskTitle: row.task_title,
      taskCode: row.task_code,
      fromDepartmentName: row.from_department_name,
      toDepartmentName: row.to_department_name,
      initiatedByName: row.initiated_by_name,
      respondedByName: row.responded_by_name,
    };
  }

  /**
   * Get handoff cycle time analytics
   * Requirements: 9.5 - Track handoff cycle time
   * Cycle time = time from initiated_at to responded_at for completed handoffs
   */
  async getCycleTimeAnalytics(filters?: {
    fromDate?: Date;
    toDate?: Date;
    fromDepartmentId?: string;
    toDepartmentId?: string;
  }): Promise<{
    averageCycleTimeHours: number;
    minCycleTimeHours: number;
    maxCycleTimeHours: number;
    totalCompleted: number;
    cycleTimeByDepartmentPair: Array<{
      fromDepartmentId: string;
      fromDepartmentName: string;
      toDepartmentId: string;
      toDepartmentName: string;
      averageCycleTimeHours: number;
      count: number;
    }>;
  }> {
    const conditions: string[] = ["h.status IN ('ACCEPTED', 'REJECTED')", "h.responded_at IS NOT NULL"];
    const params: any[] = [];

    if (filters?.fromDate) {
      conditions.push("h.initiated_at >= ?");
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      conditions.push("h.initiated_at <= ?");
      params.push(filters.toDate);
    }
    if (filters?.fromDepartmentId) {
      conditions.push("h.from_department_id = ?");
      params.push(filters.fromDepartmentId);
    }
    if (filters?.toDepartmentId) {
      conditions.push("h.to_department_id = ?");
      params.push(filters.toDepartmentId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Overall cycle time stats
    const overallQuery = `
      SELECT 
        AVG(TIMESTAMPDIFF(SECOND, h.initiated_at, h.responded_at)) / 3600 as avg_cycle_hours,
        MIN(TIMESTAMPDIFF(SECOND, h.initiated_at, h.responded_at)) / 3600 as min_cycle_hours,
        MAX(TIMESTAMPDIFF(SECOND, h.initiated_at, h.responded_at)) / 3600 as max_cycle_hours,
        COUNT(*) as total_completed
      FROM handoff_records h
      ${whereClause}
    `;

    // Cycle time by department pair
    const byPairQuery = `
      SELECT 
        h.from_department_id,
        fd.name as from_department_name,
        h.to_department_id,
        td.name as to_department_name,
        AVG(TIMESTAMPDIFF(SECOND, h.initiated_at, h.responded_at)) / 3600 as avg_cycle_hours,
        COUNT(*) as count
      FROM handoff_records h
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      ${whereClause}
      GROUP BY h.from_department_id, fd.name, h.to_department_id, td.name
      ORDER BY avg_cycle_hours DESC
    `;

    try {
      const [overallRows] = await this.db.query<RowDataPacket[]>(overallQuery, params);
      const [pairRows] = await this.db.query<RowDataPacket[]>(byPairQuery, params);

      const overall = overallRows[0] || {};

      return {
        averageCycleTimeHours: parseFloat(overall.avg_cycle_hours) || 0,
        minCycleTimeHours: parseFloat(overall.min_cycle_hours) || 0,
        maxCycleTimeHours: parseFloat(overall.max_cycle_hours) || 0,
        totalCompleted: parseInt(overall.total_completed) || 0,
        cycleTimeByDepartmentPair: pairRows.map(row => ({
          fromDepartmentId: row.from_department_id,
          fromDepartmentName: row.from_department_name || "Unknown",
          toDepartmentId: row.to_department_id,
          toDepartmentName: row.to_department_name || "Unknown",
          averageCycleTimeHours: parseFloat(row.avg_cycle_hours) || 0,
          count: parseInt(row.count) || 0,
        })),
      };
    } catch (error) {
      logger.error("Error getting cycle time analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get rejection rate analytics per department pair
   * Requirements: 9.5 - Track rejection rate
   */
  async getRejectionRateAnalytics(filters?: {
    fromDate?: Date;
    toDate?: Date;
    fromDepartmentId?: string;
    toDepartmentId?: string;
  }): Promise<{
    overallRejectionRate: number;
    totalHandoffs: number;
    totalRejected: number;
    totalAccepted: number;
    totalPending: number;
    rejectionRateByDepartmentPair: Array<{
      fromDepartmentId: string;
      fromDepartmentName: string;
      toDepartmentId: string;
      toDepartmentName: string;
      totalHandoffs: number;
      rejectedCount: number;
      acceptedCount: number;
      rejectionRate: number;
    }>;
    topRejectionReasons: Array<{
      reason: string;
      count: number;
    }>;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.fromDate) {
      conditions.push("h.initiated_at >= ?");
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      conditions.push("h.initiated_at <= ?");
      params.push(filters.toDate);
    }
    if (filters?.fromDepartmentId) {
      conditions.push("h.from_department_id = ?");
      params.push(filters.fromDepartmentId);
    }
    if (filters?.toDepartmentId) {
      conditions.push("h.to_department_id = ?");
      params.push(filters.toDepartmentId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Overall rejection stats
    const overallQuery = `
      SELECT 
        COUNT(*) as total_handoffs,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as total_rejected,
        SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as total_accepted,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as total_pending
      FROM handoff_records h
      ${whereClause}
    `;

    // Rejection rate by department pair
    const byPairQuery = `
      SELECT 
        h.from_department_id,
        fd.name as from_department_name,
        h.to_department_id,
        td.name as to_department_name,
        COUNT(*) as total_handoffs,
        SUM(CASE WHEN h.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN h.status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_count
      FROM handoff_records h
      LEFT JOIN departments fd ON h.from_department_id = fd.id
      LEFT JOIN departments td ON h.to_department_id = td.id
      ${whereClause}
      GROUP BY h.from_department_id, fd.name, h.to_department_id, td.name
      ORDER BY total_handoffs DESC
    `;

    // Top rejection reasons
    const reasonsQuery = `
      SELECT 
        rejection_reason as reason,
        COUNT(*) as count
      FROM handoff_records h
      ${whereClause ? whereClause + " AND" : "WHERE"} status = 'REJECTED' AND rejection_reason IS NOT NULL
      GROUP BY rejection_reason
      ORDER BY count DESC
      LIMIT 10
    `;

    try {
      const [overallRows] = await this.db.query<RowDataPacket[]>(overallQuery, params);
      const [pairRows] = await this.db.query<RowDataPacket[]>(byPairQuery, params);
      const [reasonRows] = await this.db.query<RowDataPacket[]>(reasonsQuery, params);

      const overall = overallRows[0] || {};
      const totalHandoffs = parseInt(overall.total_handoffs) || 0;
      const totalRejected = parseInt(overall.total_rejected) || 0;
      const totalAccepted = parseInt(overall.total_accepted) || 0;
      const totalPending = parseInt(overall.total_pending) || 0;

      // Calculate rejection rate only from completed handoffs (not pending)
      const completedHandoffs = totalRejected + totalAccepted;
      const overallRejectionRate = completedHandoffs > 0 
        ? (totalRejected / completedHandoffs) * 100 
        : 0;

      return {
        overallRejectionRate: Math.round(overallRejectionRate * 100) / 100,
        totalHandoffs,
        totalRejected,
        totalAccepted,
        totalPending,
        rejectionRateByDepartmentPair: pairRows.map(row => {
          const total = parseInt(row.total_handoffs) || 0;
          const rejected = parseInt(row.rejected_count) || 0;
          const accepted = parseInt(row.accepted_count) || 0;
          const completed = rejected + accepted;
          const rate = completed > 0 ? (rejected / completed) * 100 : 0;

          return {
            fromDepartmentId: row.from_department_id,
            fromDepartmentName: row.from_department_name || "Unknown",
            toDepartmentId: row.to_department_id,
            toDepartmentName: row.to_department_name || "Unknown",
            totalHandoffs: total,
            rejectedCount: rejected,
            acceptedCount: accepted,
            rejectionRate: Math.round(rate * 100) / 100,
          };
        }),
        topRejectionReasons: reasonRows.map(row => ({
          reason: row.reason,
          count: parseInt(row.count) || 0,
        })),
      };
    } catch (error) {
      logger.error("Error getting rejection rate analytics", error as Error, { filters });
      throw error;
    }
  }
}
