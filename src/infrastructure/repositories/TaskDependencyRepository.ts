import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("TaskDependencyRepository");

/**
 * Dependency type enum
 * BLOCKS: Hard dependency - task cannot start until dependency is complete
 * RELATES_TO: Soft reference - informational link between tasks
 */
export type DependencyType = 'BLOCKS' | 'RELATES_TO';

/**
 * Task dependency interface
 * Requirements: 8.3 - Task dependency relationships
 */
export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DependencyType;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Task dependency with additional task info for display
 */
export interface TaskDependencyWithDetails extends TaskDependency {
  dependsOnTaskTitle: string;
  dependsOnTaskCode: string;
  dependsOnTaskStatus: string;
  taskTitle?: string;
  taskCode?: string;
}

/**
 * Repository for managing task dependencies
 * Requirements: 8.3 - Task dependency relationships and conflict warnings
 */
export class TaskDependencyRepository {
  private db = dbPool;

  /**
   * Get all dependencies for a task (tasks that this task depends on)
   */
  async getDependenciesByTaskId(taskId: string): Promise<TaskDependencyWithDetails[]> {
    const query = `
      SELECT 
        td.id,
        td.task_id as taskId,
        td.depends_on_task_id as dependsOnTaskId,
        td.dependency_type as dependencyType,
        td.created_by as createdBy,
        td.created_at as createdAt,
        t.title as dependsOnTaskTitle,
        t.code as dependsOnTaskCode,
        t.status as dependsOnTaskStatus
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.task_id = ? AND t.deleted_at IS NULL
      ORDER BY td.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows as TaskDependencyWithDetails[];
    } catch (error) {
      logger.error("Error in getDependenciesByTaskId", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Get all tasks that depend on a specific task (dependents)
   */
  async getDependentsByTaskId(taskId: string): Promise<TaskDependencyWithDetails[]> {
    const query = `
      SELECT 
        td.id,
        td.task_id as taskId,
        td.depends_on_task_id as dependsOnTaskId,
        td.dependency_type as dependencyType,
        td.created_by as createdBy,
        td.created_at as createdAt,
        t.title as taskTitle,
        t.code as taskCode,
        t.status as taskStatus
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE td.depends_on_task_id = ? AND t.deleted_at IS NULL
      ORDER BY td.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => ({
        ...row,
        dependsOnTaskTitle: '',
        dependsOnTaskCode: '',
        dependsOnTaskStatus: ''
      })) as TaskDependencyWithDetails[];
    } catch (error) {
      logger.error("Error in getDependentsByTaskId", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Create a new dependency between tasks
   * Returns the created dependency ID
   */
  async createDependency(
    taskId: string,
    dependsOnTaskId: string,
    dependencyType: DependencyType = 'BLOCKS',
    createdBy: string | null = null
  ): Promise<string> {
    const id = crypto.randomUUID();

    const query = `
      INSERT INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      await this.db.query(query, [id, taskId, dependsOnTaskId, dependencyType, createdBy]);
      logger.info("Created task dependency", { id, taskId, dependsOnTaskId, dependencyType });
      return id;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Dependency already exists between these tasks');
      }
      if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
        throw new Error('A task cannot depend on itself');
      }
      logger.error("Error in createDependency", error as Error, { taskId, dependsOnTaskId });
      throw error;
    }
  }

  /**
   * Delete a dependency by ID
   */
  async deleteDependency(id: string): Promise<void> {
    const query = `DELETE FROM task_dependencies WHERE id = ?`;

    try {
      await this.db.query(query, [id]);
      logger.info("Deleted task dependency", { id });
    } catch (error) {
      logger.error("Error in deleteDependency", error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a dependency by task and depends_on_task IDs
   */
  async deleteDependencyByTasks(taskId: string, dependsOnTaskId: string): Promise<void> {
    const query = `DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?`;

    try {
      await this.db.query(query, [taskId, dependsOnTaskId]);
      logger.info("Deleted task dependency by tasks", { taskId, dependsOnTaskId });
    } catch (error) {
      logger.error("Error in deleteDependencyByTasks", error as Error, { taskId, dependsOnTaskId });
      throw error;
    }
  }

  /**
   * Check if a dependency exists between two tasks
   */
  async dependencyExists(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count 
      FROM task_dependencies 
      WHERE task_id = ? AND depends_on_task_id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId, dependsOnTaskId]);
      return rows[0].count > 0;
    } catch (error) {
      logger.error("Error in dependencyExists", error as Error, { taskId, dependsOnTaskId });
      throw error;
    }
  }

  /**
   * Get all dependencies for a project (all tasks in the project)
   */
  async getDependenciesByProjectId(projectId: string): Promise<TaskDependencyWithDetails[]> {
    const query = `
      SELECT 
        td.id,
        td.task_id as taskId,
        td.depends_on_task_id as dependsOnTaskId,
        td.dependency_type as dependencyType,
        td.created_by as createdBy,
        td.created_at as createdAt,
        t1.title as taskTitle,
        t1.code as taskCode,
        t2.title as dependsOnTaskTitle,
        t2.code as dependsOnTaskCode,
        t2.status as dependsOnTaskStatus
      FROM task_dependencies td
      JOIN tasks t1 ON td.task_id = t1.id
      JOIN tasks t2 ON td.depends_on_task_id = t2.id
      WHERE t1.project_id = ? 
        AND t1.deleted_at IS NULL 
        AND t2.deleted_at IS NULL
      ORDER BY td.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
      return rows as TaskDependencyWithDetails[];
    } catch (error) {
      logger.error("Error in getDependenciesByProjectId", error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get all task IDs that a task transitively depends on (for cycle detection)
   * Uses recursive CTE to traverse the dependency graph
   */
  async getAllTransitiveDependencies(taskId: string): Promise<string[]> {
    const query = `
      WITH RECURSIVE dependency_chain AS (
        -- Base case: direct dependencies
        SELECT depends_on_task_id as task_id, 1 as depth
        FROM task_dependencies
        WHERE task_id = ?
        
        UNION ALL
        
        -- Recursive case: dependencies of dependencies
        SELECT td.depends_on_task_id, dc.depth + 1
        FROM task_dependencies td
        INNER JOIN dependency_chain dc ON td.task_id = dc.task_id
        WHERE dc.depth < 100  -- Prevent infinite loops with depth limit
      )
      SELECT DISTINCT task_id FROM dependency_chain
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => row.task_id);
    } catch (error) {
      logger.error("Error in getAllTransitiveDependencies", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Check if adding a dependency would create a cycle
   * Returns true if a cycle would be created
   * Requirements: 8.3 - Detect cycles before adding new dependency
   */
  async wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    // A cycle would be created if:
    // 1. taskId == dependsOnTaskId (self-reference) - handled by DB constraint
    // 2. dependsOnTaskId already depends on taskId (directly or transitively)
    
    // Check if dependsOnTaskId transitively depends on taskId
    const transitiveDeps = await this.getAllTransitiveDependencies(dependsOnTaskId);
    return transitiveDeps.includes(taskId);
  }

  /**
   * Detect the cycle path if adding a dependency would create one
   * Returns the cycle path as an array of task IDs, or null if no cycle
   */
  async detectCyclePath(taskId: string, dependsOnTaskId: string): Promise<string[] | null> {
    // First check if a cycle would be created
    const wouldCycle = await this.wouldCreateCycle(taskId, dependsOnTaskId);
    if (!wouldCycle) {
      return null;
    }

    // Find the path from dependsOnTaskId back to taskId
    const query = `
      WITH RECURSIVE dependency_path AS (
        -- Base case: start from dependsOnTaskId
        SELECT 
          task_id,
          depends_on_task_id,
          CAST(depends_on_task_id AS CHAR(2000)) as path,
          1 as depth
        FROM task_dependencies
        WHERE task_id = ?
        
        UNION ALL
        
        -- Recursive case: follow the chain
        SELECT 
          td.task_id,
          td.depends_on_task_id,
          CONCAT(dp.path, ',', td.depends_on_task_id),
          dp.depth + 1
        FROM task_dependencies td
        INNER JOIN dependency_path dp ON td.task_id = dp.depends_on_task_id
        WHERE dp.depth < 100
          AND FIND_IN_SET(td.depends_on_task_id, dp.path) = 0  -- Avoid revisiting
      )
      SELECT path FROM dependency_path
      WHERE depends_on_task_id = ?
      LIMIT 1
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [dependsOnTaskId, taskId]);
      if (rows.length > 0) {
        // Build the full cycle path
        const pathStr = rows[0].path as string;
        const cyclePath = [taskId, dependsOnTaskId, ...pathStr.split(',')];
        return cyclePath;
      }
      // Fallback: return a simple cycle indication
      return [taskId, dependsOnTaskId, taskId];
    } catch (error) {
      logger.error("Error in detectCyclePath", error as Error, { taskId, dependsOnTaskId });
      // Return simple cycle indication on error
      return [taskId, dependsOnTaskId, taskId];
    }
  }
}
