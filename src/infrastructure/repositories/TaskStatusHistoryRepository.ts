/**
 * TaskStatusHistoryRepository
 * 
 * Repository for managing task status history records.
 * Implements Requirements 8.5: WHEN a task status changes THEN the Nexus_System 
 * SHALL record the change with timestamp and actor.
 */

import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import * as crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("TaskStatusHistoryRepository");

export interface TaskStatusHistoryEntry {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  changedAt: Date;
  note?: string | null;
}

export interface CreateStatusHistoryParams {
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  note?: string | null;
}

export class TaskStatusHistoryRepository {
  private db = dbPool;

  /**
   * Record a status change in the history table
   * 
   * @param params - The status change details
   * @returns The ID of the created history entry
   */
  async recordStatusChange(params: CreateStatusHistoryParams): Promise<string> {
    const id = crypto.randomUUID();
    const changedAt = new Date();

    const query = `
      INSERT INTO task_status_history (
        id, task_id, from_status, to_status, changed_by, changed_at, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.db.query(query, [
        id,
        params.taskId,
        params.fromStatus,
        params.toStatus,
        params.changedBy,
        changedAt,
        params.note || null
      ]);

      logger.info("Task status change recorded", {
        historyId: id,
        taskId: params.taskId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        changedBy: params.changedBy
      });

      return id;
    } catch (error) {
      logger.error("Failed to record task status change", error as Error, {
        taskId: params.taskId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus
      });
      throw error;
    }
  }

  /**
   * Get the status history for a specific task
   * 
   * @param taskId - The task ID
   * @returns Array of status history entries ordered by changed_at descending
   */
  async getHistoryByTaskId(taskId: string): Promise<TaskStatusHistoryEntry[]> {
    const query = `
      SELECT 
        tsh.id,
        tsh.task_id as taskId,
        tsh.from_status as fromStatus,
        tsh.to_status as toStatus,
        tsh.changed_by as changedBy,
        tsh.changed_at as changedAt,
        tsh.note,
        u.full_name as changedByName,
        u.avatar_url as changedByAvatarUrl
      FROM task_status_history tsh
      LEFT JOIN users u ON tsh.changed_by = u.id
      WHERE tsh.task_id = ?
      ORDER BY tsh.changed_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => ({
        id: row.id,
        taskId: row.taskId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedBy: row.changedBy,
        changedAt: row.changedAt,
        note: row.note,
        changedByName: row.changedByName,
        changedByAvatarUrl: row.changedByAvatarUrl
      }));
    } catch (error) {
      logger.error("Failed to get task status history", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get the most recent status change for a task
   * 
   * @param taskId - The task ID
   * @returns The most recent status history entry or null
   */
  async getLatestStatusChange(taskId: string): Promise<TaskStatusHistoryEntry | null> {
    const query = `
      SELECT 
        tsh.id,
        tsh.task_id as taskId,
        tsh.from_status as fromStatus,
        tsh.to_status as toStatus,
        tsh.changed_by as changedBy,
        tsh.changed_at as changedAt,
        tsh.note
      FROM task_status_history tsh
      WHERE tsh.task_id = ?
      ORDER BY tsh.changed_at DESC
      LIMIT 1
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      if (rows.length === 0) {
        return null;
      }
      
      const row = rows[0];
      return {
        id: row.id,
        taskId: row.taskId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedBy: row.changedBy,
        changedAt: row.changedAt,
        note: row.note
      };
    } catch (error) {
      logger.error("Failed to get latest task status change", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get status history entries by user (who made the changes)
   * 
   * @param userId - The user ID who made the changes
   * @param limit - Maximum number of entries to return
   * @returns Array of status history entries
   */
  async getHistoryByUserId(userId: string, limit: number = 50): Promise<TaskStatusHistoryEntry[]> {
    const query = `
      SELECT 
        tsh.id,
        tsh.task_id as taskId,
        tsh.from_status as fromStatus,
        tsh.to_status as toStatus,
        tsh.changed_by as changedBy,
        tsh.changed_at as changedAt,
        tsh.note,
        t.title as taskTitle,
        t.code as taskCode
      FROM task_status_history tsh
      LEFT JOIN tasks t ON tsh.task_id = t.id
      WHERE tsh.changed_by = ?
      ORDER BY tsh.changed_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [userId, limit]);
      return rows.map(row => ({
        id: row.id,
        taskId: row.taskId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedBy: row.changedBy,
        changedAt: row.changedAt,
        note: row.note,
        taskTitle: row.taskTitle,
        taskCode: row.taskCode
      })) as TaskStatusHistoryEntry[];
    } catch (error) {
      logger.error("Failed to get status history by user", error as Error, { userId });
      throw error;
    }
  }

  /**
   * Delete all status history for a task (used when task is permanently deleted)
   * Note: With ON DELETE CASCADE, this happens automatically when task is deleted
   * 
   * @param taskId - The task ID
   */
  async deleteHistoryByTaskId(taskId: string): Promise<void> {
    const query = `DELETE FROM task_status_history WHERE task_id = ?`;

    try {
      await this.db.query(query, [taskId]);
      logger.info("Task status history deleted", { taskId });
    } catch (error) {
      logger.error("Failed to delete task status history", error as Error, { taskId });
      throw error;
    }
  }
}
