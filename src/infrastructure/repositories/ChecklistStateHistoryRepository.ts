/**
 * ChecklistStateHistoryRepository
 * Data access layer for checklist_state_history table
 * 
 * Requirements: 11.1 - Record who completed checklist item and when
 * Requirements: 11.3 - Log changes when item is unchecked after being checked
 */

import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("ChecklistStateHistoryRepository");

/**
 * Checklist state change action types
 */
export type ChecklistAction = 'CHECKED' | 'UNCHECKED';

/**
 * Checklist state history entry
 */
export interface ChecklistStateHistoryEntry {
  id: string;
  checklistItemId: string;
  taskId: string;
  action: ChecklistAction;
  actorId: string;
  actorName: string | null;
  reason: string | null;
  createdAt: Date;
}

/**
 * Data for creating a new state history entry
 */
export interface CreateChecklistStateHistoryData {
  checklistItemId: string;
  taskId: string;
  action: ChecklistAction;
  actorId: string;
  actorName?: string;
  reason?: string;
}

export class ChecklistStateHistoryRepository {
  private db = dbPool;

  /**
   * Record a checklist state change
   * Requirements: 11.1, 11.3
   */
  async recordStateChange(data: CreateChecklistStateHistoryData): Promise<string> {
    const id = crypto.randomUUID();
    
    const query = `
      INSERT INTO checklist_state_history (
        id, checklist_item_id, task_id, action, actor_id, actor_name, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    try {
      await this.db.query(query, [
        id,
        data.checklistItemId,
        data.taskId,
        data.action,
        data.actorId,
        data.actorName || null,
        data.reason || null
      ]);

      logger.info("Recorded checklist state change", {
        id,
        checklistItemId: data.checklistItemId,
        action: data.action,
        actorId: data.actorId
      });

      return id;
    } catch (error) {
      logger.error("Error recording checklist state change", error as Error, {
        checklistItemId: data.checklistItemId,
        action: data.action
      });
      throw error;
    }
  }

  /**
   * Get state history for a specific checklist item
   */
  async getHistoryByChecklistItemId(checklistItemId: string): Promise<ChecklistStateHistoryEntry[]> {
    const query = `
      SELECT 
        csh.*,
        u.full_name as actor_full_name
      FROM checklist_state_history csh
      LEFT JOIN users u ON csh.actor_id = u.id
      WHERE csh.checklist_item_id = ?
      ORDER BY csh.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [checklistItemId]);
      return rows.map(row => this.mapRowToEntry(row));
    } catch (error) {
      logger.error("Error getting checklist history by item", error as Error, { checklistItemId });
      throw error;
    }
  }

  /**
   * Get state history for all checklist items in a task
   */
  async getHistoryByTaskId(taskId: string): Promise<ChecklistStateHistoryEntry[]> {
    const query = `
      SELECT 
        csh.*,
        u.full_name as actor_full_name,
        tci.text as item_text
      FROM checklist_state_history csh
      LEFT JOIN users u ON csh.actor_id = u.id
      LEFT JOIN task_checklist_items tci ON csh.checklist_item_id = tci.id
      WHERE csh.task_id = ?
      ORDER BY csh.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => this.mapRowToEntry(row));
    } catch (error) {
      logger.error("Error getting checklist history by task", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get state history entries by actor (user who made changes)
   */
  async getHistoryByActorId(actorId: string, limit: number = 50): Promise<ChecklistStateHistoryEntry[]> {
    const query = `
      SELECT 
        csh.*,
        u.full_name as actor_full_name,
        tci.text as item_text,
        t.title as task_title
      FROM checklist_state_history csh
      LEFT JOIN users u ON csh.actor_id = u.id
      LEFT JOIN task_checklist_items tci ON csh.checklist_item_id = tci.id
      LEFT JOIN tasks t ON csh.task_id = t.id
      WHERE csh.actor_id = ?
      ORDER BY csh.created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [actorId, limit]);
      return rows.map(row => this.mapRowToEntry(row));
    } catch (error) {
      logger.error("Error getting checklist history by actor", error as Error, { actorId });
      throw error;
    }
  }

  /**
   * Get the most recent state change for a checklist item
   */
  async getLatestStateChange(checklistItemId: string): Promise<ChecklistStateHistoryEntry | null> {
    const query = `
      SELECT 
        csh.*,
        u.full_name as actor_full_name
      FROM checklist_state_history csh
      LEFT JOIN users u ON csh.actor_id = u.id
      WHERE csh.checklist_item_id = ?
      ORDER BY csh.created_at DESC
      LIMIT 1
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [checklistItemId]);
      return rows.length > 0 ? this.mapRowToEntry(rows[0]) : null;
    } catch (error) {
      logger.error("Error getting latest checklist state change", error as Error, { checklistItemId });
      throw error;
    }
  }

  /**
   * Get count of state changes for a checklist item
   */
  async getStateChangeCount(checklistItemId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM checklist_state_history
      WHERE checklist_item_id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [checklistItemId]);
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error("Error getting checklist state change count", error as Error, { checklistItemId });
      throw error;
    }
  }

  /**
   * Map database row to ChecklistStateHistoryEntry
   */
  private mapRowToEntry(row: RowDataPacket): ChecklistStateHistoryEntry {
    return {
      id: row.id,
      checklistItemId: row.checklist_item_id,
      taskId: row.task_id,
      action: row.action as ChecklistAction,
      actorId: row.actor_id,
      actorName: row.actor_name || row.actor_full_name || null,
      reason: row.reason,
      createdAt: row.created_at
    };
  }
}
