/**
 * ChecklistAnalyticsRepository
 * Data access layer for checklist analytics queries
 * 
 * Requirements: 11.5 - Track completion time and frequently skipped items
 */

import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import { createLogger } from "../logging/index.js";

const logger = createLogger("ChecklistAnalyticsRepository");

/**
 * Completion time analytics for checklist items
 */
export interface ChecklistCompletionTimeAnalytics {
  averageCompletionTimeHours: number;
  minCompletionTimeHours: number;
  maxCompletionTimeHours: number;
  totalCompleted: number;
  completionTimeByTask: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    averageCompletionTimeHours: number;
    itemsCompleted: number;
  }>;
  completionTimeByDepartment: Array<{
    departmentId: string;
    departmentName: string;
    averageCompletionTimeHours: number;
    itemsCompleted: number;
  }>;
}

/**
 * Skipped items analytics
 */
export interface SkippedItemsAnalytics {
  totalSkippedItems: number;
  totalMandatorySkipped: number;
  skippedRate: number;
  frequentlySkippedItems: Array<{
    itemText: string;
    taskId: string;
    taskTitle: string;
    skipCount: number;
    isMandatory: boolean;
    lastSkippedAt: Date;
  }>;
  skippedByDepartment: Array<{
    departmentId: string;
    departmentName: string;
    skippedCount: number;
    mandatorySkippedCount: number;
  }>;
}

export interface ChecklistAnalyticsFilters {
  fromDate?: Date;
  toDate?: Date;
  projectId?: string;
  departmentId?: string;
  taskId?: string;
}

export class ChecklistAnalyticsRepository {
  private db = dbPool;

  /**
   * Get completion time analytics for checklist items
   * Requirements: 11.5 - Track completion time
   * 
   * Completion time is calculated as the time between when a checklist item
   * was created and when it was marked as completed.
   */
  async getCompletionTimeAnalytics(filters?: ChecklistAnalyticsFilters): Promise<ChecklistCompletionTimeAnalytics> {
    logger.info("Getting checklist completion time analytics", { filters });

    try {
      // Build WHERE clause based on filters
      const whereConditions: string[] = ["tci.is_completed = TRUE", "tci.completed_at IS NOT NULL"];
      const params: any[] = [];

      if (filters?.fromDate) {
        whereConditions.push("tci.completed_at >= ?");
        params.push(filters.fromDate);
      }
      if (filters?.toDate) {
        whereConditions.push("tci.completed_at <= ?");
        params.push(filters.toDate);
      }
      if (filters?.projectId) {
        whereConditions.push("t.project_id = ?");
        params.push(filters.projectId);
      }
      if (filters?.departmentId) {
        whereConditions.push("p.department_id = ?");
        params.push(filters.departmentId);
      }
      if (filters?.taskId) {
        whereConditions.push("tci.task_id = ?");
        params.push(filters.taskId);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(" AND ")}` 
        : "";

      // Overall completion time statistics
      const overallQuery = `
        SELECT 
          AVG(TIMESTAMPDIFF(HOUR, tci.created_at, tci.completed_at)) as avg_hours,
          MIN(TIMESTAMPDIFF(HOUR, tci.created_at, tci.completed_at)) as min_hours,
          MAX(TIMESTAMPDIFF(HOUR, tci.created_at, tci.completed_at)) as max_hours,
          COUNT(*) as total_completed
        FROM task_checklist_items tci
        JOIN tasks t ON tci.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ${whereClause}
      `;

      const [overallRows] = await this.db.query<RowDataPacket[]>(overallQuery, params);
      const overall = overallRows[0] as RowDataPacket || {};

      // Completion time by task
      const byTaskQuery = `
        SELECT 
          t.id as task_id,
          t.title as task_title,
          t.project_id,
          p.name as project_name,
          AVG(TIMESTAMPDIFF(HOUR, tci.created_at, tci.completed_at)) as avg_hours,
          COUNT(*) as items_completed
        FROM task_checklist_items tci
        JOIN tasks t ON tci.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ${whereClause}
        GROUP BY t.id, t.title, t.project_id, p.name
        ORDER BY avg_hours DESC
        LIMIT 20
      `;

      const [byTaskRows] = await this.db.query<RowDataPacket[]>(byTaskQuery, params);

      // Completion time by department
      const byDeptQuery = `
        SELECT 
          d.id as department_id,
          d.name as department_name,
          AVG(TIMESTAMPDIFF(HOUR, tci.created_at, tci.completed_at)) as avg_hours,
          COUNT(*) as items_completed
        FROM task_checklist_items tci
        JOIN tasks t ON tci.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        ${whereClause}
        GROUP BY d.id, d.name
        HAVING d.id IS NOT NULL
        ORDER BY avg_hours DESC
      `;

      const [byDeptRows] = await this.db.query<RowDataPacket[]>(byDeptQuery, params);

      return {
        averageCompletionTimeHours: parseFloat(overall.avg_hours) || 0,
        minCompletionTimeHours: parseFloat(overall.min_hours) || 0,
        maxCompletionTimeHours: parseFloat(overall.max_hours) || 0,
        totalCompleted: parseInt(overall.total_completed) || 0,
        completionTimeByTask: byTaskRows.map(row => ({
          taskId: row.task_id,
          taskTitle: row.task_title,
          projectId: row.project_id,
          projectName: row.project_name || "Unknown",
          averageCompletionTimeHours: parseFloat(row.avg_hours) || 0,
          itemsCompleted: parseInt(row.items_completed) || 0,
        })),
        completionTimeByDepartment: byDeptRows.map(row => ({
          departmentId: row.department_id,
          departmentName: row.department_name || "Unknown",
          averageCompletionTimeHours: parseFloat(row.avg_hours) || 0,
          itemsCompleted: parseInt(row.items_completed) || 0,
        })),
      };
    } catch (error) {
      logger.error("Error getting completion time analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get frequently skipped items analytics
   * Requirements: 11.5 - Track frequently skipped items
   * 
   * A "skipped" item is one that was unchecked after being checked,
   * or a mandatory item that remains unchecked when the task is completed.
   */
  async getSkippedItemsAnalytics(filters?: ChecklistAnalyticsFilters): Promise<SkippedItemsAnalytics> {
    logger.info("Getting skipped items analytics", { filters });

    try {
      // Build WHERE clause based on filters
      const whereConditions: string[] = [];
      const params: any[] = [];

      if (filters?.fromDate) {
        whereConditions.push("csh.created_at >= ?");
        params.push(filters.fromDate);
      }
      if (filters?.toDate) {
        whereConditions.push("csh.created_at <= ?");
        params.push(filters.toDate);
      }
      if (filters?.projectId) {
        whereConditions.push("t.project_id = ?");
        params.push(filters.projectId);
      }
      if (filters?.departmentId) {
        whereConditions.push("p.department_id = ?");
        params.push(filters.departmentId);
      }
      if (filters?.taskId) {
        whereConditions.push("csh.task_id = ?");
        params.push(filters.taskId);
      }

      // Items that were unchecked (skipped after being checked)
      const uncheckedWhereClause = whereConditions.length > 0 
        ? `WHERE csh.action = 'UNCHECKED' AND ${whereConditions.join(" AND ")}` 
        : "WHERE csh.action = 'UNCHECKED'";

      // Overall skipped statistics from history
      const overallQuery = `
        SELECT 
          COUNT(DISTINCT csh.checklist_item_id) as total_skipped,
          COUNT(DISTINCT CASE WHEN tci.is_mandatory = TRUE THEN csh.checklist_item_id END) as mandatory_skipped
        FROM checklist_state_history csh
        JOIN task_checklist_items tci ON csh.checklist_item_id = tci.id
        JOIN tasks t ON csh.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ${uncheckedWhereClause}
      `;

      const [overallRows] = await this.db.query<RowDataPacket[]>(overallQuery, params);
      const overall = overallRows[0] as RowDataPacket || {};

      // Get total checklist items for rate calculation
      const totalItemsQuery = `
        SELECT COUNT(*) as total
        FROM task_checklist_items tci
        JOIN tasks t ON tci.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ${whereConditions.length > 0 ? `WHERE ${whereConditions.map(c => c.replace('csh.', 'tci.')).join(" AND ")}` : ""}
      `;
      
      const [totalItemsRows] = await this.db.query<RowDataPacket[]>(totalItemsQuery, params);
      const totalItems = parseInt(totalItemsRows[0]?.total) || 1;

      // Frequently skipped items (items that have been unchecked multiple times)
      const frequentlySkippedQuery = `
        SELECT 
          tci.text as item_text,
          tci.task_id,
          t.title as task_title,
          tci.is_mandatory,
          COUNT(*) as skip_count,
          MAX(csh.created_at) as last_skipped_at
        FROM checklist_state_history csh
        JOIN task_checklist_items tci ON csh.checklist_item_id = tci.id
        JOIN tasks t ON csh.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ${uncheckedWhereClause}
        GROUP BY tci.id, tci.text, tci.task_id, t.title, tci.is_mandatory
        ORDER BY skip_count DESC, last_skipped_at DESC
        LIMIT 20
      `;

      const [frequentlySkippedRows] = await this.db.query<RowDataPacket[]>(frequentlySkippedQuery, params);

      // Skipped by department
      const byDeptQuery = `
        SELECT 
          d.id as department_id,
          d.name as department_name,
          COUNT(DISTINCT csh.checklist_item_id) as skipped_count,
          COUNT(DISTINCT CASE WHEN tci.is_mandatory = TRUE THEN csh.checklist_item_id END) as mandatory_skipped_count
        FROM checklist_state_history csh
        JOIN task_checklist_items tci ON csh.checklist_item_id = tci.id
        JOIN tasks t ON csh.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN departments d ON p.department_id = d.id
        ${uncheckedWhereClause}
        GROUP BY d.id, d.name
        HAVING d.id IS NOT NULL
        ORDER BY skipped_count DESC
      `;

      const [byDeptRows] = await this.db.query<RowDataPacket[]>(byDeptQuery, params);

      const totalSkipped = parseInt(overall.total_skipped) || 0;

      return {
        totalSkippedItems: totalSkipped,
        totalMandatorySkipped: parseInt(overall.mandatory_skipped) || 0,
        skippedRate: totalItems > 0 ? (totalSkipped / totalItems) * 100 : 0,
        frequentlySkippedItems: frequentlySkippedRows.map(row => ({
          itemText: row.item_text,
          taskId: row.task_id,
          taskTitle: row.task_title,
          skipCount: parseInt(row.skip_count) || 0,
          isMandatory: !!row.is_mandatory,
          lastSkippedAt: row.last_skipped_at,
        })),
        skippedByDepartment: byDeptRows.map(row => ({
          departmentId: row.department_id,
          departmentName: row.department_name || "Unknown",
          skippedCount: parseInt(row.skipped_count) || 0,
          mandatorySkippedCount: parseInt(row.mandatory_skipped_count) || 0,
        })),
      };
    } catch (error) {
      logger.error("Error getting skipped items analytics", error as Error, { filters });
      throw error;
    }
  }
}
