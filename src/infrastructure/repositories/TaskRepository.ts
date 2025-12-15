import { RowDataPacket } from "mysql2";
import { dbPool, withTransaction } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("TaskRepository");

export class TaskRepository {
  private db = dbPool;

  async getTasksByProjectId(projectId: string) {
    const query = `
      SELECT 
        t.*,
        u.full_name as createdByName,
        owner.full_name as ownerName,
        owner.avatar_url as ownerAvatarUrl,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', u2.id, 
              'name', u2.full_name, 
              'avatarUrl', u2.avatar_url
            )
          )
          FROM task_assignees ta
          JOIN users u2 ON ta.user_id = u2.id
          WHERE ta.task_id = t.id
        ) as assignees
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users owner ON t.owner_id = owner.id
      WHERE t.project_id = ? AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
      return rows.map((row) => {
        let assignees = [];
        try {
          if (row.assignees) {
            assignees =
              typeof row.assignees === "string"
                ? JSON.parse(row.assignees)
                : row.assignees;
          }
        } catch (e) {
          logger.warn("Error parsing assignees JSON", { error: (e as Error).message });
          assignees = [];
        }

        return {
          ...row,
          attachments:
            typeof row.attachments === "string"
              ? JSON.parse(row.attachments)
              : row.attachments || [],
          assignees: Array.isArray(assignees) ? assignees : [],
        };
      });
    } catch (error) {
      logger.error("Error in getTasksByProjectId", error as Error, { projectId });
      throw error;
    }
  }

  async getTaskById(id: string) {
    const query = `
      SELECT 
        t.*,
        u.full_name as createdByName,
        owner.full_name as ownerName,
        owner.avatar_url as ownerAvatarUrl,
        blocker.full_name as blockedByName,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', u2.id, 
              'name', u2.full_name, 
              'avatarUrl', u2.avatar_url
            )
          )
          FROM task_assignees ta
          JOIN users u2 ON ta.user_id = u2.id
          WHERE ta.task_id = t.id
        ) as assignees
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users owner ON t.owner_id = owner.id
      LEFT JOIN users blocker ON t.blocked_by = blocker.id
      WHERE t.id = ? AND t.deleted_at IS NULL
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
    const task = rows[0] || null;
    if (task) {
      task.attachments =
        typeof task.attachments === "string"
          ? JSON.parse(task.attachments)
          : task.attachments || [];
      task.assignees = task.assignees
        ? typeof task.assignees === "string"
          ? JSON.parse(task.assignees)
          : task.assignees
        : [];
    }
    return task;
  }

  /**
   * Create a new task with assignees
   * Requirements: 12.3 - Database operations with transaction rollback
   */
  async createTask(taskData: any) {
    const taskId = crypto.randomUUID();

    await withTransaction(async (ctx) => {
      const query = `
        INSERT INTO tasks (
          id, code, project_id, title, description, 
          assignee_department_id, status, priority,
          start_date, due_date, created_by, attachments,
          owner_id, owner_assigned_at, owner_assigned_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await ctx.query(query, [
        taskId,
        taskData.code || `TASK-${Date.now()}`,
        taskData.projectId,
        taskData.title,
        taskData.description || null,
        null, // Deprecated assignee_department_id
        taskData.status || "To Do",
        taskData.priority || "Medium",
        taskData.startDate || null,
        taskData.dueDate || null,
        taskData.createdBy || null,
        JSON.stringify(taskData.attachments || []),
        taskData.ownerId || null,
        taskData.ownerId ? new Date() : null,
        taskData.ownerId ? taskData.createdBy : null,
      ]);

      // Handle Assignees
      if (
        taskData.assigneeIds &&
        Array.isArray(taskData.assigneeIds) &&
        taskData.assigneeIds.length > 0
      ) {
        const values = taskData.assigneeIds.map((userId: string) => [
          taskId,
          userId,
        ]);
        const assigneeQuery = `INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES ?`;
        await ctx.query(assigneeQuery, [values]);
      }
    });

    return taskId;
  }

  /**
   * Update a task with assignees
   * Requirements: 12.3 - Database operations with transaction rollback
   */
  async updateTask(id: string, taskData: any) {
    await withTransaction(async (ctx) => {
      // Build dynamic update query based on provided fields
      const updateParts: string[] = [];
      const values: any[] = [];

      if (taskData.title !== undefined) {
        updateParts.push("title = ?");
        values.push(taskData.title);
      }
      if (taskData.description !== undefined) {
        updateParts.push("description = ?");
        values.push(taskData.description || null);
      }
      if (taskData.status !== undefined) {
        updateParts.push("status = ?");
        values.push(taskData.status);
        updateParts.push("completed_at = ?");
        values.push(taskData.status === "Done" ? new Date() : null);
      }
      if (taskData.priority !== undefined) {
        updateParts.push("priority = ?");
        values.push(taskData.priority);
      }
      if (taskData.startDate !== undefined) {
        updateParts.push("start_date = ?");
        values.push(taskData.startDate || null);
      }
      if (taskData.dueDate !== undefined) {
        updateParts.push("due_date = ?");
        values.push(taskData.dueDate || null);
      }
      if (taskData.attachments !== undefined) {
        updateParts.push("attachments = ?");
        values.push(JSON.stringify(taskData.attachments || []));
      }
      // Handle owner update (Requirements: 8.1)
      if (taskData.ownerId !== undefined) {
        updateParts.push("owner_id = ?");
        values.push(taskData.ownerId || null);
        updateParts.push("owner_assigned_at = ?");
        values.push(taskData.ownerId ? new Date() : null);
        if (taskData.updatedBy) {
          updateParts.push("owner_assigned_by = ?");
          values.push(taskData.ownerId ? taskData.updatedBy : null);
        }
      }

      // Handle blocking fields (Requirements: 8.4)
      if (taskData.blockedReason !== undefined) {
        updateParts.push("blocked_reason = ?");
        values.push(taskData.blockedReason || null);
      }
      if (taskData.blockedAt !== undefined) {
        updateParts.push("blocked_at = ?");
        values.push(taskData.blockedAt || null);
      }
      if (taskData.blockedBy !== undefined) {
        updateParts.push("blocked_by = ?");
        values.push(taskData.blockedBy || null);
      }

      if (updateParts.length > 0) {
        values.push(id);
        const query = `
          UPDATE tasks 
          SET ${updateParts.join(", ")}
          WHERE id = ? AND deleted_at IS NULL
        `;
        await ctx.query(query, values);
      }

      // Handle Assignees
      if (
        taskData.assigneeIds !== undefined &&
        Array.isArray(taskData.assigneeIds)
      ) {
        // Remove old
        await ctx.query("DELETE FROM task_assignees WHERE task_id = ?", [
          id,
        ]);

        // Add new
        if (taskData.assigneeIds.length > 0) {
          const assigneeValues = taskData.assigneeIds.map((userId: string) => [
            id,
            userId,
          ]);
          const assigneeQuery = `INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES ?`;
          await ctx.query(assigneeQuery, [assigneeValues]);
        }
      }
    });
  }

  async deleteTask(id: string) {
    await this.db.query("UPDATE tasks SET deleted_at = NOW() WHERE id = ?", [
      id,
    ]);
  }

  /**
   * Update task status by status_id or status name (workflow-based)
   * Also updates the legacy status field with the status name
   */
  async updateTaskStatusById(taskId: string, statusIdOrName: string) {
    let statusId: string | null = null;
    let statusName: string;

    // Check if it looks like a UUID (contains dashes and is 36 chars)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        statusIdOrName
      );

    if (isUUID) {
      // Get status name from workflow_statuses by ID
      const [statusRows] = await this.db.query<RowDataPacket[]>(
        "SELECT id, name FROM workflow_statuses WHERE id = ?",
        [statusIdOrName]
      );

      if (statusRows[0]) {
        statusId = statusRows[0].id;
        statusName = statusRows[0].name;
      } else {
        throw new Error("Status not found");
      }
    } else {
      // Treat it as a status name (for fallback statuses)
      // Try to find matching workflow_status by name for this task's project
      const [taskRows] = await this.db.query<RowDataPacket[]>(
        `SELECT p.workflow_id FROM tasks t 
         JOIN projects p ON t.project_id = p.id 
         WHERE t.id = ?`,
        [taskId]
      );

      if (taskRows[0]?.workflow_id) {
        const [statusRows] = await this.db.query<RowDataPacket[]>(
          "SELECT id, name FROM workflow_statuses WHERE workflow_id = ? AND name = ?",
          [taskRows[0].workflow_id, statusIdOrName]
        );

        if (statusRows[0]) {
          statusId = statusRows[0].id;
          statusName = statusRows[0].name;
        } else {
          // No matching workflow status, just use the name directly (legacy mode)
          statusName = statusIdOrName;
        }
      } else {
        // No workflow_id, just use the name directly (legacy mode)
        statusName = statusIdOrName;
      }
    }

    const completedAt = statusName.toLowerCase() === "done" ? new Date() : null;

    await this.db.query(
      `UPDATE tasks 
       SET status_id = ?, status = ?, completed_at = ?, updated_at = NOW() 
       WHERE id = ? AND deleted_at IS NULL`,
      [statusId, statusName, completedAt, taskId]
    );

    return { statusId, statusName };
  }

  // --- Checklist Management ---

  async getTaskByChecklistId(itemId: string) {
    const query = `
        SELECT t.* 
        FROM tasks t
        JOIN task_checklist_items tci ON t.id = tci.task_id
        WHERE tci.id = ?
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [itemId]);
    return rows[0] || null;
  }

  async getTaskChecklist(taskId: string) {
    const query = `
      SELECT 
        tci.*,
        completed_user.full_name as completed_by_name,
        unchecked_user.full_name as unchecked_by_name
      FROM task_checklist_items tci
      LEFT JOIN users completed_user ON tci.completed_by = completed_user.id
      LEFT JOIN users unchecked_user ON tci.unchecked_by = unchecked_user.id
      WHERE tci.task_id = ? 
      ORDER BY tci.\`order\`, tci.created_at
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      text: row.text,
      isCompleted: !!row.is_completed, // Convert 1/0 to boolean
      isMandatory: !!row.is_mandatory, // Convert 1/0 to boolean (Requirements: 11.2)
      order: row.order,
      createdAt: row.created_at,
      // Audit fields (Requirements: 11.1, 11.3)
      completedBy: row.completed_by || null,
      completedByName: row.completed_by_name || null,
      completedAt: row.completed_at || null,
      uncheckedBy: row.unchecked_by || null,
      uncheckedByName: row.unchecked_by_name || null,
      uncheckedAt: row.unchecked_at || null,
      uncheckedReason: row.unchecked_reason || null,
    }));
  }

  /**
   * Add a checklist item to a task
   * Requirements: 11.2 - Support mandatory checklist items
   * 
   * @param taskId - The task ID
   * @param text - The checklist item text
   * @param isMandatory - Whether this item is mandatory for task completion (default: false)
   */
  async addChecklistItem(taskId: string, text: string, isMandatory: boolean = false) {
    // Get max order
    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT MAX(`order`) as maxOrder FROM task_checklist_items WHERE task_id = ?",
      [taskId]
    );
    const order = (rows[0]?.maxOrder || 0) + 1;

    const id = crypto.randomUUID();
    await this.db.query(
      "INSERT INTO task_checklist_items (id, task_id, text, `order`, is_mandatory) VALUES (?, ?, ?, ?, ?)",
      [id, taskId, text, order, isMandatory]
    );
    return id;
  }

  /**
   * Update checklist item with audit fields
   * Requirements: 11.1 - Record who completed checklist item and when
   * Requirements: 11.2 - Support mandatory checklist items
   * Requirements: 11.3 - Log changes when item is unchecked after being checked
   */
  async updateChecklistItem(
    id: string,
    updates: { 
      text?: string; 
      isCompleted?: boolean;
      isMandatory?: boolean;
      completedBy?: string;
      uncheckedBy?: string;
      uncheckedReason?: string;
    }
  ) {
    const updateParts: string[] = [];
    const values: any[] = [];

    if (updates.text !== undefined) {
      updateParts.push("text = ?");
      values.push(updates.text);
    }

    // Requirements: 11.2 - Support mandatory field update
    if (updates.isMandatory !== undefined) {
      updateParts.push("is_mandatory = ?");
      values.push(updates.isMandatory);
    }
    
    if (updates.isCompleted !== undefined) {
      updateParts.push("is_completed = ?");
      values.push(updates.isCompleted);
      
      if (updates.isCompleted) {
        // Item is being checked - record completion audit fields
        updateParts.push("completed_by = ?");
        values.push(updates.completedBy || null);
        updateParts.push("completed_at = ?");
        values.push(new Date());
        // Clear unchecked fields when checking
        updateParts.push("unchecked_by = NULL");
        updateParts.push("unchecked_at = NULL");
        updateParts.push("unchecked_reason = NULL");
      } else {
        // Item is being unchecked - record unchecked audit fields
        updateParts.push("unchecked_by = ?");
        values.push(updates.uncheckedBy || null);
        updateParts.push("unchecked_at = ?");
        values.push(new Date());
        if (updates.uncheckedReason !== undefined) {
          updateParts.push("unchecked_reason = ?");
          values.push(updates.uncheckedReason || null);
        }
        // Keep completed_by and completed_at for audit trail
        // (shows who originally completed it before it was unchecked)
      }
    }

    if (updateParts.length === 0) return;

    values.push(id);
    await this.db.query(
      `UPDATE task_checklist_items SET ${updateParts.join(", ")} WHERE id = ?`,
      values
    );
  }

  /**
   * Get a single checklist item by ID with audit fields
   * Requirements: 11.2 - Include mandatory field
   */
  async getChecklistItemById(id: string) {
    const query = `
      SELECT 
        tci.*,
        completed_user.full_name as completed_by_name,
        unchecked_user.full_name as unchecked_by_name
      FROM task_checklist_items tci
      LEFT JOIN users completed_user ON tci.completed_by = completed_user.id
      LEFT JOIN users unchecked_user ON tci.unchecked_by = unchecked_user.id
      WHERE tci.id = ?
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id,
      taskId: row.task_id,
      text: row.text,
      isCompleted: !!row.is_completed,
      isMandatory: !!row.is_mandatory, // Requirements: 11.2
      order: row.order,
      createdAt: row.created_at,
      completedBy: row.completed_by || null,
      completedByName: row.completed_by_name || null,
      completedAt: row.completed_at || null,
      uncheckedBy: row.unchecked_by || null,
      uncheckedByName: row.unchecked_by_name || null,
      uncheckedAt: row.unchecked_at || null,
      uncheckedReason: row.unchecked_reason || null,
    };
  }

  async deleteChecklistItem(id: string) {
    await this.db.query("DELETE FROM task_checklist_items WHERE id = ?", [id]);
  }

  /**
   * Get uncompleted mandatory checklist items for a task
   * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
   * 
   * @param taskId - The task ID
   * @returns Array of uncompleted mandatory checklist items
   */
  async getUncompletedMandatoryItems(taskId: string) {
    const query = `
      SELECT 
        tci.id,
        tci.task_id,
        tci.text,
        tci.is_mandatory,
        tci.is_completed,
        tci.\`order\`
      FROM task_checklist_items tci
      WHERE tci.task_id = ? 
        AND tci.is_mandatory = TRUE 
        AND tci.is_completed = FALSE
      ORDER BY tci.\`order\`, tci.created_at
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      text: row.text,
      isMandatory: !!row.is_mandatory,
      isCompleted: !!row.is_completed,
      order: row.order,
    }));
  }

  async getTasksByUserId(userId: string) {
    const query = `
      SELECT DISTINCT
        t.*,
        p.name as projectName,
        p.code as projectCode,
        u.full_name as createdByName
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      WHERE t.deleted_at IS NULL 
        AND (t.created_by = ? OR ta.user_id = ?)
      ORDER BY t.created_at DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [
      userId,
      userId,
    ]);
    return rows;
  }

<<<<<<< HEAD
  async getTasksByDepartment(
    departmentId: string,
    startDate?: string,
    endDate?: string
  ) {
    let query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assigned_to,
        u.full_name as assigned_to_name,
        t.created_by,
        t.due_date,
        t.progress,
        t.checklist,
        t.department_id,
        (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comments_count,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.department_id = ? AND t.deleted_at IS NULL
    `;

    const params: any[] = [departmentId];

    if (startDate) {
      query += ` AND DATE(t.created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(t.created_at) <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY t.due_date ASC, t.priority DESC`;

    const [rows] = await this.db.query<RowDataPacket[]>(query, params);
    return rows as any[];
  }

  async addComment(taskId: string, commentData: any) {
    const commentId = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO comments (id, task_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [
        commentId,
        taskId,
        commentData.user_id,
        commentData.content,
        commentData.created_at,
      ]
    );

    return {
      id: commentId,
      content: commentData.content,
    };
=======
  // --- Task Blocking (Requirements: 8.4) ---

  /**
   * Update task blocking status
   * Sets blocked_reason, blocked_at, and blocked_by fields
   */
  async updateTaskBlocking(
    taskId: string,
    blockedReason: string | null,
    blockedBy: string | null
  ) {
    const blockedAt = blockedReason ? new Date() : null;
    
    await this.db.query(
      `UPDATE tasks 
       SET blocked_reason = ?, blocked_at = ?, blocked_by = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [blockedReason, blockedAt, blockedBy, taskId]
    );
  }

  /**
   * Clear task blocking status (unblock task)
   */
  async clearTaskBlocking(taskId: string) {
    await this.db.query(
      `UPDATE tasks 
       SET blocked_reason = NULL, blocked_at = NULL, blocked_by = NULL, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [taskId]
    );
  }

  /**
   * Get all blocked tasks for a project
   */
  async getBlockedTasksByProjectId(projectId: string) {
    const query = `
      SELECT 
        t.*,
        u.full_name as createdByName,
        owner.full_name as ownerName,
        blocker.full_name as blockedByName
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users owner ON t.owner_id = owner.id
      LEFT JOIN users blocker ON t.blocked_by = blocker.id
      WHERE t.project_id = ? 
        AND t.deleted_at IS NULL 
        AND t.blocked_at IS NOT NULL
      ORDER BY t.blocked_at DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
    return rows;
>>>>>>> 92b9495 (backup 14-12)
  }
}
