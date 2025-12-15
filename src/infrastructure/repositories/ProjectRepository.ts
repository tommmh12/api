import { RowDataPacket } from "mysql2";
import { dbPool, withTransaction } from "../database/connection.js";
import crypto from "crypto";

export class ProjectRepository {
  private db = dbPool;

  /**
   * Get all projects with task counts
   * 
   * Requirements: 6.5 - Optimized to use pre-aggregated JOIN instead of correlated subqueries
   * This reduces query complexity from O(n) subqueries to a single aggregation
   */
  async getAllProjects(includeDeleted = false) {
    const query = `
      SELECT 
        p.*,
        u.full_name as managerName,
        w.name as workflowName,
        COALESCE(tc.taskCount, 0) as taskCount,
        COALESCE(tc.completedTaskCount, 0) as completedTaskCount
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN workflows w ON p.workflow_id = w.id
      LEFT JOIN (
        SELECT 
          project_id,
          COUNT(*) as taskCount,
          SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completedTaskCount
        FROM tasks 
        WHERE deleted_at IS NULL
        GROUP BY project_id
      ) tc ON p.id = tc.project_id
      WHERE ${includeDeleted ? "1=1" : "p.deleted_at IS NULL"}
      ORDER BY p.created_at DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query);
    return rows;
  }

  async getProjectById(id: string) {
    const query = `
      SELECT 
        p.*,
        u.full_name as managerName,
        w.name as workflowName
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN workflows w ON p.workflow_id = w.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
    return rows[0] || null;
  }

  async getProjectDepartments(projectId: string) {
    const query = `
      SELECT 
        d.id,
        d.name,
        d.code,
        pd.role,
        pd.assigned_at,
        u.full_name as managerName,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND status = 'Active') as memberCount
      FROM project_departments pd
      LEFT JOIN departments d ON pd.department_id = d.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE pd.project_id = ?
      ORDER BY pd.assigned_at
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
    return rows;
  }

  async getLatestProjectCode(): Promise<string | null> {
    const query = `SELECT code FROM projects ORDER BY created_at DESC LIMIT 1`;
    const [rows] = await this.db.query<RowDataPacket[]>(query);
    return rows.length > 0 ? rows[0].code : null;
  }

  /**
   * Create a new project with members
   * Requirements: 12.3 - Database operations with transaction rollback
   */
  async createProject(projectData: any) {
    const projectId = crypto.randomUUID();

    await withTransaction(async (ctx) => {
      const query = `
        INSERT INTO projects (
          id, code, name, description, manager_id, workflow_id, 
          status, priority, budget, start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await ctx.query(query, [
        projectId,
        projectData.code,
        projectData.name,
        projectData.description || null,
        projectData.managerId || null,
        projectData.workflowId || null,
        projectData.status || "Planning",
        projectData.priority || "Medium",
        projectData.budget || null,
        projectData.startDate || null,
        projectData.endDate || null,
      ]);

      // Invite members from departments if provided
      if (projectData.departments && projectData.departments.length > 0) {
        // Fetch all users from these departments
        const deptIds = projectData.departments; // Assumed to be string[] of UUIDs
        if (deptIds.length > 0) {
          const userQuery = `
             SELECT id FROM users 
             WHERE department_id IN (?) AND deleted_at IS NULL
           `;
          const users = await ctx.query<RowDataPacket[]>(userQuery, [
            deptIds,
          ]);

          if (users.length > 0) {
            const memberValues = users.map((u) => [projectId, u.id, "Member"]);
            // Add Manager as 'Manager' role if not already added
            if (projectData.managerId) {
              const managerExists = users.some(
                (u) => u.id === projectData.managerId
              );
              if (!managerExists) {
                memberValues.push([
                  projectId,
                  projectData.managerId,
                  "Manager",
                ]);
              } else {
                // Update the manager's role in the values if they were in the department
                const mgrIndex = memberValues.findIndex(
                  (m) => m[1] === projectData.managerId
                );
                if (mgrIndex >= 0) memberValues[mgrIndex][2] = "Manager";
              }
            }

            const memberQuery = `
               INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES ?
             `;
            await ctx.query(memberQuery, [memberValues]);
          } else if (projectData.managerId) {
            // Only manager exists
            await ctx.query(
              `INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
              [projectId, projectData.managerId, "Manager"]
            );
          }
        }
      } else if (projectData.managerId) {
        await ctx.query(
          `INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
          [projectId, projectData.managerId, "Manager"]
        );
      }
    });

    return projectId;
  }

  async updateProject(id: string, projectData: any) {
    // Build dynamic query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (projectData.name !== undefined) {
      updates.push("name = ?");
      values.push(projectData.name);
    }
    if (projectData.description !== undefined) {
      updates.push("description = ?");
      values.push(projectData.description || null);
    }
    if (projectData.managerId !== undefined) {
      updates.push("manager_id = ?");
      values.push(projectData.managerId || null);
    }
    if (projectData.workflowId !== undefined) {
      updates.push("workflow_id = ?");
      values.push(projectData.workflowId || null);
    }
    if (projectData.status !== undefined) {
      updates.push("status = ?");
      values.push(projectData.status);
    }
    if (projectData.priority !== undefined) {
      updates.push("priority = ?");
      values.push(projectData.priority);
    }
    if (projectData.progress !== undefined) {
      updates.push("progress = ?");
      values.push(projectData.progress || 0);
    }
    if (projectData.budget !== undefined) {
      updates.push("budget = ?");
      values.push(projectData.budget || null);
    }
    if (projectData.startDate !== undefined) {
      updates.push("start_date = ?");
      values.push(projectData.startDate || null);
    }
    if (projectData.endDate !== undefined) {
      updates.push("end_date = ?");
      values.push(projectData.endDate || null);
    }

    if (updates.length === 0) {
      return; // No fields to update
    }

    const query = `
      UPDATE projects 
      SET ${updates.join(", ")}
      WHERE id = ? AND deleted_at IS NULL
    `;

    values.push(id);
    await this.db.query(query, values);
  }

  async deleteProject(id: string) {
    await this.db.query("UPDATE projects SET deleted_at = NOW() WHERE id = ?", [
      id,
    ]);
  }

  async assignDepartment(
    projectId: string,
    departmentId: string,
    role?: string
  ) {
    const query = `
      INSERT INTO project_departments (project_id, department_id, role)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE role = ?
    `;

    await this.db.query(query, [
      projectId,
      departmentId,
      role || null,
      role || null,
    ]);
  }

  async removeDepartment(projectId: string, departmentId: string) {
    await this.db.query(
      "DELETE FROM project_departments WHERE project_id = ? AND department_id = ?",
      [projectId, departmentId]
    );
  }

  // --- Project Members ---

  async getProjectMembers(projectId: string) {
    const query = `
      SELECT 
        pm.*,
        u.full_name as userName,
        u.email,
        u.avatar_url,
        u.department_id,
        d.name as departmentName
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE pm.project_id = ?
      ORDER BY pm.joined_at
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
    return rows;
  }

  async addProjectMember(
    projectId: string,
    userId: string,
    role: string = "Member"
  ) {
    const query = `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE role = ?
    `;
    await this.db.query(query, [projectId, userId, role, role]);
  }

  async removeProjectMember(projectId: string, userId: string) {
    await this.db.query(
      "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
      [projectId, userId]
    );
  }

  // --- Progress Internal Calculation ---

  async recalculateProgress(projectId: string) {
    // 1. Get Task Stats
    // Count total tasks (excluding deleted)
    const [taskRows] = await this.db.query<RowDataPacket[]>(
      `
        SELECT 
            COUNT(*) as totalTasks,
            SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completedTasks
        FROM tasks 
        WHERE project_id = ? AND deleted_at IS NULL
    `,
      [projectId]
    );

    const { totalTasks, completedTasks } = taskRows[0];

    // 2. Get Checklist Item Stats
    // We need all checklist items for tasks in this project
    const [checklistRows] = await this.db.query<RowDataPacket[]>(
      `
        SELECT 
            COUNT(*) as totalItems,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completedItems
        FROM task_checklist_items tci
        JOIN tasks t ON tci.task_id = t.id
        WHERE t.project_id = ? AND t.deleted_at IS NULL
    `,
      [projectId]
    );

    const { totalItems, completedItems } = checklistRows[0];

    // 3. Calculate Weighted Progress
    // Logic: (Completed Tasks + Completed Items) / (Total Tasks + Total Items)
    const totalPoints =
      (parseInt(totalTasks) || 0) + (parseInt(totalItems) || 0);
    const earnedPoints =
      (parseInt(completedTasks) || 0) + (parseInt(completedItems) || 0);

    let progress = 0;
    if (totalPoints > 0) {
      progress = Math.round((earnedPoints / totalPoints) * 100);
    }

    // 4. Update Project
    await this.db.query("UPDATE projects SET progress = ? WHERE id = ?", [
      progress,
      projectId,
    ]);

    return progress;
  }

  /**
   * Get projects by user ID with task counts
   * 
   * Requirements: 6.5 - Optimized to use pre-aggregated JOIN instead of correlated subqueries
   */
  async getProjectsByUserId(userId: string) {
    const query = `
      SELECT DISTINCT
        p.*,
        u.full_name as managerName,
        w.name as workflowName,
        COALESCE(tc.taskCount, 0) as taskCount,
        COALESCE(tc.completedTaskCount, 0) as completedTaskCount
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN workflows w ON p.workflow_id = w.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN (
        SELECT 
          project_id,
          COUNT(*) as taskCount,
          SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completedTaskCount
        FROM tasks 
        WHERE deleted_at IS NULL
        GROUP BY project_id
      ) tc ON p.id = tc.project_id
      WHERE p.deleted_at IS NULL 
        AND (p.manager_id = ? OR pm.user_id = ?)
      ORDER BY p.created_at DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [
      userId,
      userId,
    ]);
    return rows;
  }

  /**
   * Check if user is a member of the project
   */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM project_members 
      WHERE project_id = ? AND user_id = ?
      LIMIT 1
    `;
    const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId, userId]);
    return rows.length > 0;
  }
}
