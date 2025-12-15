import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("TaskOwnershipSettingsRepository");

export interface TaskOwnershipSettings {
  id: string;
  departmentId: string;
  enforcementMode: 'warn' | 'block';
  requireOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskOwnershipSettingsRepository {
  private db = dbPool;

  /**
   * Get enforcement settings for a specific department
   */
  async getByDepartmentId(departmentId: string): Promise<TaskOwnershipSettings | null> {
    const query = `
      SELECT 
        id,
        department_id as departmentId,
        enforcement_mode as enforcementMode,
        require_owner as requireOwner,
        created_at as createdAt,
        updated_at as updatedAt
      FROM task_ownership_settings
      WHERE department_id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [departmentId]);
      if (rows.length === 0) {
        return null;
      }
      return {
        ...rows[0],
        requireOwner: !!rows[0].requireOwner
      } as TaskOwnershipSettings;
    } catch (error) {
      logger.error("Error getting task ownership settings", error as Error, { departmentId });
      throw error;
    }
  }

  /**
   * Get all enforcement settings
   */
  async getAll(): Promise<TaskOwnershipSettings[]> {
    const query = `
      SELECT 
        id,
        department_id as departmentId,
        enforcement_mode as enforcementMode,
        require_owner as requireOwner,
        created_at as createdAt,
        updated_at as updatedAt
      FROM task_ownership_settings
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query);
      return rows.map(row => ({
        ...row,
        requireOwner: !!row.requireOwner
      })) as TaskOwnershipSettings[];
    } catch (error) {
      logger.error("Error getting all task ownership settings", error as Error);
      throw error;
    }
  }

  /**
   * Create or update enforcement settings for a department
   */
  async upsert(departmentId: string, settings: Partial<Pick<TaskOwnershipSettings, 'enforcementMode' | 'requireOwner'>>): Promise<TaskOwnershipSettings> {
    const existing = await this.getByDepartmentId(departmentId);

    if (existing) {
      // Update existing
      const updateParts: string[] = [];
      const values: any[] = [];

      if (settings.enforcementMode !== undefined) {
        updateParts.push("enforcement_mode = ?");
        values.push(settings.enforcementMode);
      }
      if (settings.requireOwner !== undefined) {
        updateParts.push("require_owner = ?");
        values.push(settings.requireOwner);
      }

      if (updateParts.length > 0) {
        values.push(departmentId);
        await this.db.query(
          `UPDATE task_ownership_settings SET ${updateParts.join(", ")} WHERE department_id = ?`,
          values
        );
      }
    } else {
      // Insert new
      const id = crypto.randomUUID();
      await this.db.query(
        `INSERT INTO task_ownership_settings (id, department_id, enforcement_mode, require_owner) VALUES (?, ?, ?, ?)`,
        [
          id,
          departmentId,
          settings.enforcementMode || 'warn',
          settings.requireOwner !== undefined ? settings.requireOwner : true
        ]
      );
    }

    const result = await this.getByDepartmentId(departmentId);
    if (!result) {
      throw new Error("Failed to upsert task ownership settings");
    }
    return result;
  }

  /**
   * Delete enforcement settings for a department
   */
  async delete(departmentId: string): Promise<void> {
    await this.db.query(
      "DELETE FROM task_ownership_settings WHERE department_id = ?",
      [departmentId]
    );
  }
}
